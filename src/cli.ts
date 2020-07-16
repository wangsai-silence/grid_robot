import { prompt } from 'inquirer'
import { Auth } from './service/auth'
import { Order, OrderInfo } from './service/order'
import { Account } from './service/account'
import { Check, createConnection } from 'typeorm'
import { Checker } from './strategy/checker'
import { SpotAccount } from './websocket/spot_pool'
import { V1 } from './utils/const'
import { getLogger } from 'log4js'
import { StrategyInfo, StrategyOrder, createStrategy, StrategyType, StrategyState } from './strategy/types'
import { init } from './utils/logger'
import { sendMsg } from './utils/notifier'
import { config } from '../config'
import { Grid } from './strategy/grid'
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

    const data = await prompt(promiseArr)
    const awsId = data.id as string
    const awsKey = data.key as string

    let db = await createConnection({
        entities: [OrderInfo, StrategyInfo, StrategyOrder],
        username: config.db.username,
        password: config.db.password,
        database: config.db.database,
        host: config.db.host,
        type: "mysql",
        synchronize: true,
        logging: true,
    })

    const authService = new Auth(awsId, awsKey)
    const orderService = new Order(authService)
    const accountService = new Account(authService)

    init()

    // auth
    let s = createStrategy({
        //no use
        id: 0,
        content: {},
        state: StrategyState.On,
        createTime: '',
        updateTime: '',

        type: StrategyType.Grid,
    }, db, authService, orderService, accountService)

    await s?.cli()
}

main().then(() => getLogger().log("done!")).catch(err => getLogger().error(err)).finally(()=> process.exit())
