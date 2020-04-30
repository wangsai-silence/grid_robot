import { qGet , HttpResp, qPost, Direction} from "../../src/utils/rest"
import { async } from "rxjs/internal/scheduler/async"
import { SpotAccount } from "../../src/websocket/spot_pool"
import { V1 } from "../../src/utils/const"
import { getLogger, configure } from "log4js"
import { Auth } from "../../src/service/auth"
import { Account, AccountType, AccountInfo } from "../../src/service/account"
import { Order, OrderInfo } from "../../src/service/order"
import { createConnection } from "typeorm"
import { from, empty } from "rxjs"
import { mergeMap, filter, take, mergeMapTo } from "rxjs/operators"

interface KLine {
    amount: number,
    open: number,
    close: number,
    high: number,
    id: number,
    count: number,
    low: number,
    vol: number
}

// describe('qGet', async function(){
//     let params = {
//         symbol: 'btcusdt',
//         period: '1day',
//         size: 2
//     }

//     let res: HttpResp<Array<KLine>>  = await qGet('https://api.huobi.pro/market/history/kline', params)

//     if(res.data){
//         console.log(res.data[1])
//     }
// })

// describe('qPost', async () => {
//   let params = {
//         symbol: 'btcusdt',
//         period: '1day',
//         size: 2
//     }

//     let res: HttpResp<Array<KLine>>  = await qPost('https://api.huobi.pro/market/history/kline',params, null)

//     console.log(res)
// })

describe('ws', async() =>{
    configure({
        appenders: {
            std: {
                type: 'console'
            }
        },
        categories: {
            debug: {
                appenders: ['std'],
                level: 'debug'
            },
            default: {
                appenders: [
                    'std'
                ],
                level: 'debug'
            }
        }
    });

    let auth = new Auth('fe7a6f18-0e61bd8f-qz5c4v5b6n-0cbdc', 'e593eb2e-8db34d9c-c7b6f5e8-e56c9')

    let order = new Order(auth)

    let account = new Account(auth)

    let db = await createConnection({
        type:'sqlite',
        database: 'test/test.sqlite' ,
        entities: [OrderInfo],
        synchronize:true,
        logging: true
    })


    let orders = await account.getAccountByType(AccountType.Spot)
    .then(acc => order.getOpenOrders({
        "account-id": acc.id,
        symbol: 'adabtc'
    }))


    await from(orders).pipe(
       mergeMap(order => from(db.getRepository(OrderInfo).findOne({id: order.id})).pipe(
            mergeMap(res => {
                if(res !== undefined){
                    order._id = res._id
                }

                return db.getRepository(OrderInfo).save(order)
            })
       )),
    ).toPromise()
    .then(console.log)
    .catch(console.error)

    // let spotPool = new SpotAccount(V1.AccountWebSocket, 20000)
    // spotPool.start()
    // auth.sendAuth(spotPool).pipe(
    //     take(1),
    //     mergeMap(() => order.subOrderUpdate(spotPool, 'adabtc'))
    // )
    // .subscribe(
    //     data => console.log(data),
    //     err => console.error('????????????????????????????', err)
    // )

    let id = await account.getAccountByType(AccountType.Spot)
    account.getHistories({
        "account-id": id.id + "",
        "start-time": Math.floor(new Date().getTime() / 1000) - 3600 * 24 * 30,
        "end-time": Math.floor(new Date().getTime() / 1000) - 3600 * 24 * 10,
    })
    .then(console.log)
    .catch(console.error)
})