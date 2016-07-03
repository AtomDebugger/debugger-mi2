
declare module process {

  declare interface Readable {

    write(chunk: string, encoding?: string, callback?: Function): boolean
  }

  declare class process {

    stdin: Readable
  }
}
