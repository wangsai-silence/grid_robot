import {prompt} from 'inquirer'
import { Auth } from './service/auth'
import { Order, OrderInfo } from './service/order'
import { Account } from './service/account'
import { Check, createConnection } from 'typeorm'
import { Checker } from './strategy/checker'
import { SpotAccount } from './websocket/spot_pool'
import { V1 } from './utils/const'
import { getLogger } from 'log4js'
import { of } from 'rxjs'
import { delay } from 'rxjs/operators'
import { StrategyInfo, StrategyOrder } from './strategy/types'
import { init } from './utils/logger'
import { sendMsg } from './utils/notifier'
import { config } from '../config'
async function main() {
    process.env.UV_THREADPOOL_SIZE = "16"

    const promiseArr = [
        {
            type: 'input',
            name: 'id',
            message: 'Please input api id:\n'
        },
        {
            type: 'password',
            name: 'key',
            message: 'Please input api key:\n'
        }
    ]

    const data =  await prompt(promiseArr)
    const awsId = data.id as string
    const awsKey = data.key as string

    //create pool
    const pool = new SpotAccount(V1.AccountWebSocket)

    let db = await createConnection({
        entities: [OrderInfo, StrategyInfo, StrategyOrder],
        username: config.db.username,
        password: config.db.password,
        database: config.db.database,                
        type: "mysql",
        synchronize: false,
        logging: false,
    })

    const authService = new Auth(awsId, awsKey)
    const orderService = new Order(authService)
    const accountService = new Account(authService)

    const checker = new Checker(pool, db, authService, orderService, accountService)

    sendMsg({msg: 'quant application starting...'})

    init()

    // auth
    authService.sendAuth(pool).subscribe(
        msg => checker.start(),
        err => getLogger().error(err)
    )

    pool.start()
}

main()
process.on('uncaughtException', err => {
    getLogger().error(err)
    of(1).pipe(delay(3000)).subscribe(()=>process.exit(0))
})