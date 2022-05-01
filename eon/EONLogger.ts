import chalk from 'chalk';
export const COLOR_ERROR = chalk.bold.red;
export const COLOR_INFO = chalk.white;
export const COLOR_WARNING = chalk.yellow;
export const COLOR_NOTIFY = chalk.cyan;
export const COLOR_TRACE = chalk.gray;
export const COLOR_HEADER = chalk.cyan.bold;
export const COLOR_SUCCESS = chalk.green.bold;
export const COLOR_KEY_MESSAGE = chalk.magentaBright.bold;

export default class EONLogger {
  static enableColor() {
    chalk.level = 3;
  }

  static disableColor() {
    chalk.level = 0;
  }

  static log(message: string) {
    console.log(message);
  }
}
