import { qGet, Method, qPost } from "../utils/rest";
import { getLogger } from "log4js"
import { Auth } from "./auth";
import { V1, AccountAPI } from "../utils/const";
import {Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne} from "typeorm";
import { Subject } from "rxjs";
import { Op } from "../data/spot";
import { filter, map, tap } from "rxjs/operators";
import { MsgType } from "../data/obj";
import { BasePool } from "../websocket/base_pool";

export enum OrderType {
    BuyLimit = 'buy-limit',
    SellLimit = 'sell-limit',
    SellLimitMaker = 'sell-limit-maker',
    BuyLimitMaker = 'buy-limit-maker'
}

export enum OrderState {
    Filled = 'filled',         
    PartialFilled = 'partial-filled',
    Submitted = 'submitted',      
    PartialCanceled = 'partial-canceled',
    Canceled = 'canceled' 
}

export enum OrderSide {
    Buy = 'buy',
    Sell = 'sell',
}

@Entity()
export class OrderInfo {
    @PrimaryGeneratedColumn()
    _id: number

    @Column('bigint', {unique: true})
    id: number

    @Column('varchar', {length: 20})
    symbol: string

    @Column('bigint', {nullable: true})
    accountId: number

    @Column('varchar', {length: 50})
    amount: string

    @Column('varchar', {length: 20})
    price: string

    @Column('bigint')
    createdAt: number

    @Column('bigint', {nullable: true})
    finishedAt?: number

    @Column('bigint', {nullable: true})
    canceledAt?: number

    @Column('varchar', {length: 20})
    type: OrderType

    @Column('varchar', {length: 50, nullable: true})
    filledAmount: string

    @Column('varchar', {length: 50, nullable: true})
    filledCashAmount: string

    @Column('varchar', {length: 50, nullable: true})
    filledFees: string

    @Column('varchar', {length: 50, nullable: true})
    source?: string

    @Column('varchar', {length: 50})
    state: OrderState

    @CreateDateColumn()
    createTime?: string

    @UpdateDateColumn()
    updateTime?: string

    fill(oldInfo: OrderInfo) {
        if(!this._id)    {
            this._id = oldInfo._id
        }

        if(!this.id) {
            this.id = oldInfo.id
        }

        if(!this.filledAmount) {
            this.filledAmount = oldInfo.filledAmount
        }

        if(!this.filledCashAmount) {
            this.filledCashAmount = oldInfo.filledCashAmount
        }

        if(!this.filledFees) {
            this.filledFees = oldInfo.filledFees
        }

        if(!this.price) {
            this.price = oldInfo.price
        }

        if(!this.source) {
            this.source = oldInfo.source
        }

        if(!this.state) {
            this.state = oldInfo.state
        }

        if(!this.symbol) {
            this.symbol = oldInfo.symbol
        }

        if(!this.type) {
            this.type = oldInfo.type
        }

    }
}

export interface OpenOrdersParams {
    ['account-id']: number
    symbol: string
    size?: number
    side?: OrderSide
    from?: number
    direct?: string
}

export interface RecentOrdersParams {
    symbol?: string
    ['start-time']?: number
    ['end-time']?: number
    direct?: string
    size?: number
}

export class Order {
    auth: Auth

    constructor(auth: Auth) {
        this.auth = auth
    }

    getOpenOrders(params: OpenOrdersParams): Promise<Array<OrderInfo>> {
        const url = AccountAPI + V1.OpenOrders

        return qGet(url, this.auth.addSignature(url, Method.GET, params))
    }

    getOrderDetail(orderId: number): Promise<OrderInfo> {
        const url = AccountAPI + V1.Orders + '/' + orderId 
        return qGet(url, this.auth.addSignature(url, Method.GET, {

        }))
    }

    getRecentOrders(params: RecentOrdersParams): Promise<OrderInfo> {
        const url = AccountAPI + V1.OrderHistory

        return qGet(url, this.auth.addSignature(url, Method.GET, params))
    }

    placeOrder(input: NewOrder): Promise<string> {
        const url = AccountAPI + V1.PlaceOrder

        return qPost(url, input, this.auth.addSignature(url, Method.POST, {}))
    }

    cancelOrder(orderId: string) {
        const url = `${AccountAPI}${V1.Orders}/${orderId}/submitcancel`

        return qPost(url, {}, this.auth.addSignature(url, Method.POST, {}))
    }

    batchPlaceOrders(inputs: Array<NewOrder>): Promise<{ orderId: string }> {
        const url = AccountAPI + V1.BatchPlaceOrder
        return qPost(url, inputs, this.auth.addSignature(url, Method.POST, {}))
    }

    batchCancelOrders(inputs: Array<string>) {
        const url = AccountAPI + V1.BatchCancelOrder
        return qPost(url, { ['order-ids']: inputs }, this.auth.addSignature(url, Method.POST, {}))
    }

    //ws 
    subOrderUpdate(pool: BasePool, symbol: string): Subject<OrderInfo> {
        let topic = `orders.*.update`

        let res = new Subject<OrderInfo>()

        pool.messageQueue.pipe(
            filter(msg => msg.msgType === MsgType.Msg && msg.data !== undefined),
            map(msg => JSON.parse(<string>msg.data)),
            filter(msg => msg.topic === topic && msg.op === Op.Notify),
        ).subscribe(data => {
            if(data.errCode){
                res.error(data)
            }else{
                if(data.data){
                    let order = new OrderInfo()

                    order.type = data.data.orderType
                    order.id = data.data.orderId
                    order.symbol = data.data.symbol
                    order.price = data.data.price
                    order.state = data.data.orderState
                    order.filledAmount = data.data.filledAmount
                    order.filledCashAmount = data.data.filledCashAmount

                    if(order.state === OrderState.Submitted){
                        order.amount = data.data.unfilledAmount
                        order.createdAt = data.ts
                    }

                    if(order.state === OrderState.Canceled) {
                        order.canceledAt = data.ts
                    }

                    res.next(order)
                }
            }
        })

       pool.send({
           op: Op.Sub,
           topic: topic
       })

       return res
    }

    convertSubDataToOrderInfo(data : any): OrderInfo {
        let order = new OrderInfo()

        if(data.eventType === 'creation') {
            order.id = data.orderId
            order.symbol = data.symbol
            order.state = data.orderStatus
            order.type = data.type
            order.price = data.orderPrice
            order.amount = data.orderSize
            order.createdAt = data.orderCreateTime
        }else if (data.eventType === 'trade') {
            order.id = data.orderId
            order.symbol = data.symbol
            order.type = data.type
            order.state = data.orderStatus
            order.price = data.tradePrice
            order.filledCashAmount = data.tradeVolume
        }else if (data.eventType === 'cancellation') {
            order.id = data.orderId
            order.symbol = data.symbol
            order.state = data.orderStatus
            order.type = data.type
            order.price = data.orderPrice
            order.amount = data.orderSize
        }

        return  order
    }
}

export interface OrderNotify {
    op: Op,
    ts: number,
    topic: string,
    data: OrderNotifyData 
}

interface OrderNotifyData{
    orderType: OrderType,
    role: string,
    unfilledAmount: string,
    clientOrderId: string,
    symbol: string,
    orderId: number,
    matchId: number,
    filledCashAmount: string,
    filledAmount: string,
    price:string,
    orderState: OrderState
}

export interface NewOrder {
    ['account-id']: string,
    symbol: string,
    type: OrderType,
    amount: string,
    price?: string,
    source?: string,
    ['client-order-id']?: string
}

export interface BatchCancelOrderResult {
    sucess?: Array<string>
    failed?: Array<{
        orderState: number
        orderId: string
        errCode: string
        errMsg: string
    }>
}
