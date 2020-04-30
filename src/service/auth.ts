import { BasePool } from "../websocket/base_pool"
import { Subject, Observable } from "rxjs"
import { filter, map } from "rxjs/operators"
import * as urlUtil from 'url'
import { getLogger } from "log4js"
import * as crypto from 'crypto'
import { Method } from "../utils/rest"
import {Op} from '../data/spot'
import {MsgType, Msg, PlainObj} from '../data/obj'

interface AuthResp {
    op: Op,
    errCode?: string
}

export class Auth {
    id:string 
    key: string

    constructor (id: string, key: string) {
        this.id = id
        this.key = key
    }

    sendAuth (pool: BasePool): Observable<Msg> {
        const authPassedSubject = new Subject<Msg>()

        pool.messageQueue.pipe(
            filter(data => data.msgType === MsgType.Open),
        ).subscribe(() => {
            const data = this.addSignature(pool.url, Method.GET, {})
            data.op = Op.Auth

            pool.send(data)
        })

        pool.messageQueue.pipe(
            filter(data => data.msgType === MsgType.Msg && data.data !== undefined),
            map(data => JSON.parse(<string>data.data)),
            filter(data => data.op == Op.Auth && !data.errCode)
        ).subscribe(data => authPassedSubject.next(data))

        return authPassedSubject
    }

    addSignature (url: string, method: Method, params: PlainObj): PlainObj {
        const timeStamp = Auth.getUTCTime()
        params.Timestamp = timeStamp
        params.SignatureMethod = 'HmacSHA256'
        params.SignatureVersion = '2'
        params.AccessKeyId = this.id

        const sorted: PlainObj = {}
        Object.keys(params).sort().forEach(key =>  sorted[key] = encodeURIComponent(params[key]))

        const urlInfo = urlUtil.parse(url)
        let toBeSigned = `${method.toUpperCase()}\n` +
        `${urlInfo.host}\n` +
        `${urlInfo.path}\n` +
        `${Object.keys(sorted).map(key => key + '=' + sorted[key]).join('&')}`

        getLogger().info(toBeSigned)
        const signature = crypto.createHmac('sha256', this.key).update(toBeSigned, 'utf8').digest('base64')
        params.Signature = signature

        return params
    }

    static getUTCTime () {
        return new Date().toISOString().slice(0, -5)
    }
}