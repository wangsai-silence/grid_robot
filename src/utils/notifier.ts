import { PlainObj } from "../data/obj"
import * as rp from 'request-promise'
import { from } from "rxjs"
import { config } from "../../config"
import { getLogger } from "log4js"

export function sendMsg(message: string | PlainObj): void {
    let msgObj = null
    if (typeof message === 'string') {
        msgObj = JSON.parse(message)
    } else {
        msgObj = message
    }

    /*
     * curl 'https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxx' \
     * -H 'Content-Type: application/json' \
     * -d '{"msgtype": "text", 
     *      "text": {
     *           "content": "我就是我, 是不一样的烟火"
     *      }
     *    }'   
     */

    from(rp.post({
        uri: config.notifier.dingding.webhook,
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36'
        },
        json: {
            msgtype: 'text',
            text: {
                content: JSON.stringify(msgObj, null, 2)
            }
        }
    })).subscribe(
        console.log,
        err => getLogger().error(err)
    )
}

export function sendAlert(message: PlainObj): void {
    from(rp.post({
        uri: config.notifier.dingding.webhook,
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36',
        },
        json: {
            msgtype: 'text',
            text: {
                content: JSON.stringify(message, null, 2)
            },
            at: { atMobiles: config.notifier.dingding.mobiles }
        }
    })).subscribe(
        null,
        err => getLogger().error(err)
    )
}