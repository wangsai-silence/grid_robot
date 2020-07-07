import { Auth } from "../service/auth"
import { Order, OrderInfo, OrderState, OrderType } from "../service/order"
import { Account } from "../service/account"
import { Subject, from, interval, Subscription, zip, of } from "rxjs"
import { getLogger } from "log4js"
import { tap, debounceTime, mergeMap, concatMap, retry, map, toArray, distinct, flatMap, delay, filter, mapTo } from "rxjs/operators"
import { Connection, In } from "typeorm"
import { StrategyOrder, StrategyInfo, createStrategy, Strategy } from "./types"
import { BasePool } from "../websocket/base_pool"
import { sendMsg } from "../utils/notifier"
import { config } from "../../config"

export class Checker {
    db: Connection
    authService: Auth
    orderService: Order
    accountService: Account

    taskCheckSubject: Subject<number>

    subscription: Subscription | undefined

    pool: BasePool

    constructor(pool: BasePool, conn: Connection, authService: Auth, orderService: Order, accountService: Account) {
        this.pool = pool
        this.db = conn
        this.authService = authService
        this.orderService = orderService
        this.accountService = accountService

        this.taskCheckSubject = new Subject<number>()

        this.taskCheckSubject.pipe(
            tap(() => getLogger().debug('start check task info')),
            debounceTime(1000),
            mergeMap(id => from(id >= 0
                ? this.db.getRepository(StrategyInfo).find({ id: id })
                : this.db.getRepository(StrategyInfo).find())),
            mergeMap(strategies => from(strategies)),
            concatMap(strategy => from(this.handleStrategy(strategy))),
            // catchError(err => of(`caught error:${err}`)),
            //TODO move to config 
            retry(10),
        ).subscribe(
            data => getLogger().info(data),
            err => {
                getLogger().warn('Retried 10 times then quit')
                getLogger().error(err)
            },
            () => getLogger().warn('Task subscribe is finished. This should never happen.')
        )

        interval(config.grid.taskCheckInterval).subscribe(() => this.taskCheckSubject.next(-1))
    }

    async start() {
        //check task info 
        let strategies = await from(this.db.getRepository(StrategyInfo).find()).pipe(
            mergeMap(infos => from(infos)),
            toArray()
        ).toPromise()

        //sync order
        await from(strategies).pipe(
            concatMap(strategy => this.db.getRepository(OrderInfo)
                .createQueryBuilder("o")
                .leftJoinAndSelect("strategy_order", "so", "so.orderId = o.id")
                .where("o.state in (:s1, :s2) and so.strategyId = :id", { id: strategy.id, s1: OrderState.Submitted, s2: OrderState.PartialFilled })
                .getMany()),
            flatMap(orders => from(orders)),
            concatMap(order => from(this.orderService.getOrderDetail(order.id)).pipe(delay(100))),
            // mergeMap((old, newO) => this.db.getRepository(OrderInfo).update(old, newO)),
            mergeMap(info => this.db.createQueryBuilder().update(OrderInfo).set({ state: info.state }).where("id=:id", { id: info.id }).execute())
        ).toPromise()

        //subscribe order changes
        await from(strategies).pipe(
            map(info => createStrategy(info, this.db, this.authService, this.orderService, this.accountService)),
            mergeMap(strategy => from((strategy as Strategy).getSymbols())),
            distinct(),
            toArray(),
            mergeMap(symbols => Promise.resolve(this.addOrderSubscriber(symbols))
            )
        ).toPromise()

        //check strategy 
        from(strategies).pipe(
            concatMap(strategy => of(strategy.id).pipe(delay(1000))),
        ).subscribe(
            id => this.taskCheckSubject.next(id),
            err => getLogger().error(err)
        )
    }

    addOrderSubscriber(symbols: Array<string>) {
        if (this.subscription) {
            this.subscription.unsubscribe()
        }

        this.subscription = this.orderService.subOrderUpdate(this.pool, "*").pipe(
            // mergeMap(symbol => this.orderService.subOrderUpdate(this.pool, symbol)),
            tap(msg => sendMsg(msg)),
            concatMap(order => from(this.db.getRepository(OrderInfo).findOne({ id: order.id })).pipe(
                mergeMap(o => {
                    if (o) {
                        o.state = order.state,
                            o.filledAmount = order.filledAmount
                        return this.db.getRepository(OrderInfo).save(o)
                    }

                    return this.db.getRepository(OrderInfo).save(order)
                })
            )),
            filter(order => order.state === OrderState.Filled),
            mergeMap(order => this.db.getRepository(StrategyOrder).findOne({ where: { orderId: order.id } })),
        ).subscribe(
            data => this.taskCheckSubject.next(data?.strategyId),
            err => getLogger().error(err)
        )
    }


    async handleStrategy(info: StrategyInfo) {
        let strategy = createStrategy(info, this.db, this.authService, this.orderService, this.accountService)
        if (!strategy) {
            return
        }

        try {
            await strategy.run()
        }catch(err) {
            getLogger().error(err)
        }
    }
}
