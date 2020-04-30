import WebSocket from "ws"
import { Observable, Observer } from "rxjs"
import { inflate } from "pako"
import { MsgType, Msg } from "../data/obj"
import { changeToCamelCase } from "../utils/string"

export class WebSocketClient {
    client: WebSocket

    constructor (url: string){
        this.client = new WebSocket(url) 
    }

    onObserve(observer: Observer<Msg>): void {
        try {

            this.client.on('open', () => observer.next({
                msgType: MsgType.Open
            }))

            this.client.on('close', () => observer.next({
                msgType: MsgType.Close
            }))

            this.client.on('message', data => {
                let res = inflate(<Uint8Array>data, {to: 'string'})
                let result: Msg = {
                    msgType: MsgType.Msg,
                    data: changeToCamelCase(res)
                }

                observer.next(result)
            })

            this.client.on('error', err => observer.error(err))
        } catch (error) {
            this.client.on('error', err => observer.error(err))
        }
    }

    connect ():Observable<Msg> {
        return Observable.create(this.onObserve.bind(this))
    }

    send (message: string) {
        this.client.send(message)
    }
}