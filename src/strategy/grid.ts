import { Auth } from "../service/auth"
import { Order, OrderInfo, OrderState, OrderType } from "../service/order"
import { Account, AccountType, BalanceType, BalanceInfo } from "../service/account"
import { getLogger } from "log4js"
import { tap, mergeMap, concatMap, map, toArray, reduce, filter, delay, take } from "rxjs/operators"
import { Connection, In } from "typeorm"
import { StrategyOrder, StrategyInfo, StrategyState, Strategy, StrategyType } from "./types"
import {BigNumber} from 'bignumber.js';
import { getMergedDetail, getAllSymbolInfo, getSymbolInfo, SymbolInfo } from "../service/market"
import { from, merge } from "rxjs"
import {prompt} from 'inquirer'
import { PlainObj } from "../data/obj"

const FixedPricePrec = 8

export class Grid implements Strategy {
    info: StrategyInfo

    db: Connection
    authService: Auth
    orderService: Order
    accountService: Account

    symbol: string
    rate: string
    prices: string[]
    count: number
    amount: string

    constructor (info :StrategyInfo, conn: Connection, authService: Auth, orderService: Order, accountService: Account){
        this.info = info

        let content = info.content
        this.symbol = content.symbol
        this.rate = content.rate
        this.prices = content.prices
        this.count = content.count
        this.amount = content.amount


        this.db = conn
        this.authService = authService
        this.orderService = orderService
        this.accountService = accountService
    }

    getSymbols(): string[] {
        return [this.symbol]
    }

    async run() {
        if(this.info.state == StrategyState.On) {
            await this.handleOpen()
        }else {
            await this.handleClosed()
        }
    }

    async handleOpen () {
        getLogger().info(`handle open tasks:${JSON.stringify(this.info)}`)
        //get current price
        const curPrice = await getMergedDetail(this.symbol).then(data => data.close)

         let orderPrices = await from(this.db.getRepository(OrderInfo)
                .createQueryBuilder("o")
                .leftJoinAndSelect("strategy_order", "so", "so.orderId = o.id")
                .where("o.state in (:s1, :s2) and so.strategyId = :id", {id: this.info.id, s1: OrderState.Submitted, s2: OrderState.PartialFilled})
                .getMany()).pipe(
                    mergeMap(orders => from(orders)),
                    map(order => new BigNumber(order.price).toFixed(FixedPricePrec)),
                    reduce((acc, price) => {
                    acc.set(price, '') 

                        return acc
                    }, new Map<string, string>())
                ).toPromise()

        getLogger().debug(`cur price: ${curPrice}`)
        getLogger().debug(`cur order prices: ${Array.from(orderPrices.keys()).toString()}`)

        //check out lack price
        const lackPrices = await from(this.prices).pipe(
            filter(price => !orderPrices.has(new BigNumber(price).toFixed(FixedPricePrec))),
            toArray(),
            filter(prices => prices.length > 1),
            mergeMap(prices => from(prices)),
            filter(price => new BigNumber(price).minus(new BigNumber(curPrice)).abs().div(BigNumber.min(curPrice, price)).comparedTo(new BigNumber(this.rate).div(2)) >= 0),
            tap(price => getLogger().debug(`price passed filter: ${price}`)),
            toArray()
        ).toPromise()

        if (lackPrices.length <= 0) {
            getLogger().warn(`no lack price for ${this.info}`)
        } else {
            getLogger().warn(`task ${this.info} lack price: ${lackPrices}`)
        }

        //check whether balance is enough or not 
        const symbolInfo = getSymbolInfo(this.symbol) 
        if(!symbolInfo) {
            getLogger().fatal(`failed to get symbol info[${this.symbol}]`)
            return 
        }

        const balanceNeeded = new Map<string, BigNumber>()        
        balanceNeeded.set(symbolInfo.baseCurrency, new BigNumber(0))
        balanceNeeded.set(symbolInfo.quoteCurrency, new BigNumber(0))

        lackPrices.forEach(item => {
            if(new BigNumber(item).comparedTo(curPrice) <=0) {
                let org =  balanceNeeded.get(symbolInfo.quoteCurrency)
                if(org)
                    balanceNeeded.set(symbolInfo.quoteCurrency, org.plus(new BigNumber(item).times(this.amount)))
            }else{
                let org = balanceNeeded.get(symbolInfo.baseCurrency)
                if(org)
                    balanceNeeded.set(symbolInfo.baseCurrency, org.plus(this.amount))
            }
        })

        const account = await this.accountService.getAccountByType(AccountType.Spot);
        const balance = await from(this.accountService.getBalance(account)).pipe(
            mergeMap(data => from(data.list)),
            filter(balance => balance.type === BalanceType.Trade),
            tap(data => {
                if(data.balance !== '0'){
                    getLogger().debug(data)
                }
            }),
            reduce((acc, value)=> {
                acc.set(value.currency, value)
                return acc
            }, new Map<string, BalanceInfo>()),
        ).toPromise()
        
        for(const [
                key,
                value
                ] of balanceNeeded){
            if(!balance.has(key) || value.comparedTo(new BigNumber((balance.get(key) as BalanceInfo).balance))>0){
                getLogger().warn(`task ${this.info} need ${key} ${value}, but account just has ${balance.get(key)?.balance}`)
                return
            }

            getLogger().info(`task ${this.info} need ${key} ${value}, account has ${balance.get(key)?.balance}`)
        }

        //place order
        from(lackPrices).pipe(
            map(price => ({
                ['account-id']: account.id + "",
                symbol: this.symbol,
                type: new BigNumber(price).comparedTo(curPrice) <= 0 ? OrderType.BuyLimitMaker: OrderType.SellLimitMaker,
                amount: this.amount,
                price: price,
            })),
            concatMap(params => from(this.orderService.placeOrder(params)).pipe(delay(200))),
            map(id => ({
                strategyId: this.info.id,
                orderId: parseInt(id)
            })),
            toArray(),
            concatMap(data => this.db.getRepository(StrategyOrder).save(data))
        ).subscribe(
            data => getLogger().log(data),
            err => getLogger().error(err),
        )
    }

    async handleClosed (){
        getLogger().info(`handle closed tasks:${JSON.stringify(this.info)}`)
        //get task orders
            
        const result = await from(this.db.getRepository(OrderInfo)
                .createQueryBuilder("o")
                .leftJoinAndSelect("strategy_order", "so", "so.orderId = o.id")
                .where("o.state in (:s1, :s2) and so.strategyId = :id", {id: this.info.id, s1: OrderState.Submitted, s2: OrderState.PartialFilled})
                .getMany()).pipe(
	    mergeMap(orders => from(orders)),
            map(order => order.id + ''),
            toArray(),
            filter(orderIds => orderIds.length > 0),
            concatMap(orderIds => this.orderService.batchCancelOrders(orderIds)),
        ).toPromise()

        getLogger().info(`batch cancel orders ${result} success`)
    }

    async cli() {
        const symbolInfo = await from(prompt({
            type: 'input',
            name: 'symbol',
            message: 'Please input trade symbol:\n'
        })).pipe(
            mergeMap(data => from(getAllSymbolInfo()).pipe(
                        mergeMap(symbols => from(symbols)), 
                        filter(symbol => symbol.symbol === data.symbol),
                        take(1)
                    )
                ),
        ).toPromise()
    
        const marketInfo = await getMergedDetail(symbolInfo.symbol)
        const curPrice = new BigNumber(marketInfo.close)

        //input params
        const promiseArr = [
            {
                type: 'input',
                name: 'start-price',
                message: `Please input start price (Cur price:${marketInfo.close}, Precision:${symbolInfo.pricePrecision} ):\n`
            },
            {
                type: 'input',
                name: 'end-price',
                message: `Please input end price (Cur price:${marketInfo.close}, Precision:${symbolInfo.pricePrecision}):\n`
            },
            {
                type: 'input',
                name: 'grid-count',
                message: 'Please input grid count:\n'
            },
            {
                type: 'input',
                name: 'grid-amount',
                message: `Please input amount for every grid(Precision:${symbolInfo.amountPrecision}):\n`
            }
        ]
       
        const inputInfos = await prompt(promiseArr)

        inputInfos.symbol = symbolInfo.symbol

        //calc rate
        const sPrice = new BigNumber(inputInfos['start-price'] as string)
        const ePrice = new BigNumber(inputInfos['end-price'] as string)
        const gAmount = new BigNumber(inputInfos['grid-amount'] as string)
        const gCount = parseInt(inputInfos['grid-count'] as string)
        
        if (sPrice.gte(ePrice)){
            throw new Error('start price is higher than end price')
        }

        if(gCount <=0){
            throw new Error('grid count should greater than 0')
        }
        
        const rate = new BigNumber(Math.pow(ePrice.div(sPrice).toNumber(), 1.0/gCount) - 1)
    
        let gridPrices = new Array<BigNumber>()
        gridPrices.push(sPrice)

        for(let i = 1; i < gCount; i ++) {
            gridPrices.push(gridPrices[i-1].times(rate.plus(1)))
        }
        gridPrices.push(ePrice)
   
        //check account balance enough
        const result = await this.calcBalance(symbolInfo.symbol, gridPrices, gAmount, curPrice)
        if(!result){
            getLogger().error('no enough balance')
            return
        }
    
        const confirm = await prompt({
            type: 'confirm',
            name: 'confirm',
            message: `Calculate rate result is:${rate.toString()}, with trading fee included. 
         Every grid finished you can earn ${gAmount.times(rate)}. 
         Would you like to continue?`,
            default: false 
        })
    
        if(!confirm.confirm){
            return
        }

        this.db.getRepository(StrategyInfo).save({
            state: StrategyState.On,
            type: StrategyType.Grid,
            content: {
                symbol: symbolInfo.symbol,
                rate: rate.toFixed(4),
                prices: gridPrices.map(p => p.toFixed(symbolInfo.pricePrecision as number)),
                count: gCount,
                amount: gAmount.toFixed(symbolInfo.amountPrecision as number)
            } as PlainObj
        })
   
        return
    }

    async calcBalance (symbol :string, gridPrices: Array<BigNumber>, gridAmount: BigNumber, curPrice: BigNumber){
        const needBalanceMap = new Map<string, BigNumber>()
        const symbolInfo = getSymbolInfo(symbol) as SymbolInfo
    
        needBalanceMap.set(symbolInfo.quoteCurrency, new BigNumber(0))
        needBalanceMap.set(symbolInfo.baseCurrency, new BigNumber(0))
    
        gridPrices.forEach(price => {
            if(price.gte(curPrice)){
                needBalanceMap.set(symbolInfo.baseCurrency, (needBalanceMap.get(symbolInfo.baseCurrency) as BigNumber).plus(new BigNumber(gridAmount)))
            }else {
                needBalanceMap.set(symbolInfo.quoteCurrency, (needBalanceMap.get(symbolInfo.quoteCurrency) as BigNumber).plus(new BigNumber(gridAmount).times(price)))
            }
        });
    
        const account = await this.accountService.getAccountByType(AccountType.Spot)
    
        const balanceMap = await from(this.accountService.getBalance(account)).pipe(
                mergeMap(data => from(data.list)),
                filter(data => data.type === BalanceType.Trade),
                reduce((acc, value)=>{
                    acc.set(value.currency, value.balance); 
                    return acc
                }, new Map())
            ).toPromise()
    
        getLogger().info(`need ${symbolInfo.baseCurrency} ${needBalanceMap.get(symbolInfo.baseCurrency)} got ${balanceMap.get(symbolInfo.baseCurrency)}, 
                     need ${symbolInfo.quoteCurrency} ${needBalanceMap.get(symbolInfo.quoteCurrency)} got ${balanceMap.get(symbolInfo.quoteCurrency)}`)
    
        return new BigNumber(balanceMap.get(symbolInfo.baseCurrency)).gte(needBalanceMap.get(symbolInfo.baseCurrency)as BigNumber) &&  
            new BigNumber(balanceMap.get(symbolInfo.quoteCurrency)).gte(needBalanceMap.get(symbolInfo.quoteCurrency)as BigNumber)
    }
}
