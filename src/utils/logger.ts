import * as log4js from "log4js";
import { config } from "../../config";
import { sendAlert } from "./notifier";
import log4jsExtend from "log4js-extend";

function registerErr() {
  let prop = Reflect.getPrototypeOf(log4js.getLogger()) as any;
  const orgLogger = prop.error;

  prop.error = function error(message: any, ...args: any[]): void {
    const arrArgs = [];
    arrArgs.push(message);
    arrArgs.push(args);
    Reflect.apply(orgLogger, log4js.getLogger(), arrArgs);

    //call dingding
    if (message instanceof Error) {
      sendAlert(message);
      return;
    }

    sendAlert(message);
  };
}

export function init() {
  log4js.configure({
    appenders: {
      std: {
        type: "console",
      },
      file: {
        type: "file",
        filename: config.log.file,
        maxLogSize: 10485760,
        backups: 10,
        pattern: ".yyyy-MM-dd",
        compress: true,
      },
    },
    categories: {
      debug: {
        appenders: ["std"],
        level: "debug",
      },
      default: {
        appenders: ["file", "std"],
        level: "debug",
      },
      websocket: {
        appenders: ["file", "std"],
        level: "debug",
      },
    },
  });

  // log4jsExtend(log4js, {
  //     path: '.',
  //     format: '[@name @file:@line:@column]'
  // })
  registerErr();
  log4js.getLogger().info("Logger config finished");
}
