import chalk from 'chalk';
export const COLOR_ERROR = chalk.bold.red;
export const COLOR_INFO = chalk.white;
export const COLOR_INFO_BOLD = chalk.white.bold;
export const COLOR_WARNING = chalk.yellow;
export const COLOR_NOTIFY = chalk.cyan;
export const COLOR_TRACE = chalk.gray;
export const COLOR_TRACE_ITALIC = chalk.gray.bold.italic;
export const COLOR_HEADER = chalk.cyan.bold;
export const COLOR_SUCCESS = chalk.green.bold;
export const COLOR_KEY_MESSAGE = chalk.magentaBright.bold;
export const COLOR_EON_YELLOW = chalk.hex('#DAD600').bold.italic;
export const COLOR_EON_BLUE = chalk.hex('#00738B').bold;
export const COLOR_EON_BLUE_BG = chalk.bgHex('#00738B').white.bold;

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
