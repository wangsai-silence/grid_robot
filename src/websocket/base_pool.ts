import { Subject, from, Subscription, Observable, merge, interval } from 'rxjs'
import {tap, debounceTime, filter, mapTo, delay} from 'rxjs/operators'
import {getLogger} from 'log4js'
import { WebSocketClient } from './client'
import { Msg, MsgType } from '../data/obj'

export abstract class BasePool {
    public readonly url: string
    public messageQueue: Subject<Msg>

    aliveCheckInterval: number

    restartSubject: Subject<string>

    client: WebSocketClient | null
    mainSubscription: Subscription| null
    closeSubscription: Subscription| null

    heartbeatSubscription: Subscription| null
    lastReceivedData: Msg | null
    

    constructor (url: string, aliveCheckInterval: number = 30000) {
        this.url = url

        this.messageQueue = new Subject()

        this.restartSubject = new Subject()

        this.aliveCheckInterval = aliveCheckInterval

        this.restartSubject.pipe(
            tap(data => getLogger('websocket').debug(`received a reconnect command:${data}`)),
            debounceTime(aliveCheckInterval/3)
        ).subscribe(() => {
            getLogger('websocket').info(`websocket ${this.url} may be disconnected. try reconnect.`)
            this.start()
        })

        this.client = null
        this.mainSubscription = null
        this.closeSubscription = null
        this.heartbeatSubscription = null

        this.lastReceivedData = null
    }

    start () {
        this.client = new WebSocketClient(this.url) 
        const messageObservable = this.client.connect() 

        this.mainSubscription = messageObservable.subscribe(
            data => {
                getLogger('websocket').info(data)
                this.messageQueue.next(data)
            })
        
         //restart when closed
        this.closeSubscription = messageObservable.pipe(
              filter(data => data.msgType === MsgType.Close)
          ).subscribe(()=>this.reConnect('closed'))
         

        this.heartbeat(messageObservable)
    }

    send (messaage: any) {
        getLogger('websocket').info(`send message:${JSON.stringify(messaage)}`)

        try {
            this.client?.send(JSON.stringify(messaage))
        } catch (err) {
            getLogger('websocket').error(err)
            // this.reConnect('error happens')
        }
    }

    reConnect (signal: string){
        getLogger('websocket').debug('reconnect ....')

        if(this.mainSubscription != null){
            this.mainSubscription.unsubscribe()
        }

        if(this.closeSubscription != null){
            this.closeSubscription.unsubscribe()
        }

        if(this.heartbeatSubscription){
            this.heartbeatSubscription.unsubscribe()
        }

        this.lastReceivedData = null
        this.restartSubject.next(signal)
    }

    heartbeat (messageObservable: Observable<Msg>) {
        this.heartbeatSubscription = merge(
            interval(this.aliveCheckInterval).pipe(mapTo({
                msgType: MsgType.Check
            })),
            messageObservable
        ).subscribe(
            data => {
                if ((this.lastReceivedData != null && this.lastReceivedData.msgType === MsgType.Check) 
                    && (data != null && data.msgType === MsgType.Check)) {
                    this.reConnect('timeout')

                    return
                }

                this.lastReceivedData = data

                this.responseHeartbeat(data)
            },
            err => {
                getLogger('websocket').error(err)

                from([1])
                    .pipe(delay(1000 * 5))
                    .subscribe(()=>this.reConnect('heartbeat error happens'))
            }
        )
    }

    abstract responseHeartbeat(data: Msg):void;
}