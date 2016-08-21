'use babel'

/* @flow */

import MessageAdapter from './message-adapter'
import { Emitter }    from 'atom'

type ResolveHandler = (o: Promise<any> | any) => void
type RejectHandler  = (e: any) => void
type ResultHandler  = {resolve: ResolveHandler, reject: RejectHandler}

export default class InterpreterMi2 {
  emitter: Emitter;
  adapter: MessageAdapter;
  resultHandlerQueue: Array<ResultHandler>;

  constructor() {
    this.emitter            = new Emitter()
    this.adapter            = new MessageAdapter()
    this.resultHandlerQueue = []
  }

  interpret(data: string) {

    const SessionEvent    = require('./main').SessionEvent
    const TargetEvent     = require('./main').TargetEvent

    if (!SessionEvent) {
      throw Error('SessionEvent must not be null')
    }

    if (!TargetEvent) {
      throw Error('TargetEvent must not be null')
    }

    for (let line of data.split('\n')) {

      const resultBegin = line.indexOf(',')
      const result = (resultBegin > 0) ?
        this.convertResult(line.slice(resultBegin+1)) : undefined

      if (/^\*running/.test(line)) {

        this.emitter.emit('session', new SessionEvent('resumed'))
      } else if (/^\*stopped/.test(line)) {

        if (!result || typeof result.reason !== 'string' ) {
          throw new Error('result.reason must be string')
        }

        if (result.reason == 'breakpoint-hit') {

          let message = this.adapter.adaptSessionMessage(result)
          this.emitter.emit('session', new SessionEvent('suspended', 'breakpoint', message))
        } else if (result.reason == 'exited-normally') {

          this.emitter.emit('session', new SessionEvent('will-terminate'))
        }
      } else if (/^\^done|\^running/.test(line)) {

        if (this.resultHandlerQueue.length == 0) { return }

        let handler = this.resultHandlerQueue.shift()

        handler.resolve(result)

      } else if (/^\^error/.test(line)) {

        const message = (result) ? result.msg : 'Unknown error occured'
        atom.notifications.addError(message, { dismissable: true })

        let handler = this.resultHandlerQueue.shift()

        handler.reject(result)
      } else if (/^\^exit/.test(line)) {

        let handler = this.resultHandlerQueue.shift()

        handler.resolve(result)

        this.emitter.emit('session', new SessionEvent('terminated', 'normally'))

      } else if (/^@/.test(line)) {

        if (!line.startsWith('@"')) {
          this.emitter.emit('target', new TargetEvent('output', line.substr(1)))
        }

        let stripped = line.slice(2,-1)

        stripped = stripped.replace('\\r', '\r').replace('\\n', '\n')

        this.emitter.emit('target', new TargetEvent('output', stripped))
      }
    }
  }

  convertValue(value: string): mixed {

    const stripped = value.slice(1,-1)

    if (value.charAt(0) == '"') {

      return stripped
    } else if (value.charAt(0) == '{') {

      return this.convertResult(stripped)
    } else if (value.charAt(0) == '[') {

      const isNamed = (value.indexOf('=') < value.search(/[{("]/))

      let result = []

      let indexStart = 0
      let scopeDepth = 0
      let name

      for (let i=0; i<stripped.length; i++) {
        if (stripped.charAt(i) === '{') {
          scopeDepth++
        } else if (stripped.charAt(i) === '}') {
          scopeDepth--
        } else if (isNamed && stripped.charAt(i) === '=' && scopeDepth === 0) {
          name       = stripped.substring(indexStart, i)
          indexStart = i+1;
        } else if (stripped.charAt(i) === ',' && scopeDepth === 0) {
          const attribute  = stripped.substring(indexStart, i)

          let value
          if (isNamed) {
            value       = new Object
            value[name] = this.convertValue(attribute)
          } else {
            value = this.convertValue(attribute)
          }

          result.push(value)
          indexStart = i+1
        }
      }

      const attribute  = stripped.substring(indexStart)

      if (isNamed) {
        let value   = new Object
        value[name] = this.convertValue(attribute)
        result.push(value)
      } else {
        result.push(this.convertValue(attribute))
      }

      return result
    }
  }

  convertResult(value: string): Object {
    let result = new Object;

    let indexStart = 0
    let scopeDepth = 0

    for (let i=0; i<value.length; i++) {
      if (value.charAt(i) == '{' || value.charAt(i) == '[') {
        scopeDepth++
      } else if (value.charAt(i) == '}' || value.charAt(i) == ']') {
        scopeDepth--
      } else if (value.charAt(i) == ',' && scopeDepth == 0) {

        const attribute  = value.substring(indexStart, i)
        const name       = attribute.slice(0, attribute.indexOf('='))
        const val        = attribute.slice(attribute.indexOf('=')+1)

        result[name] = this.convertValue(val)
        indexStart = i+1
      }
    }

    const attribute  = value.substring(indexStart)
    const name       = attribute.slice(0, attribute.indexOf('='))
    const val        = attribute.slice(attribute.indexOf('=')+1)

    result[name] = this.convertValue(val)

    return result
  }

  pushResultHandler(resolve: ResolveHandler, reject: RejectHandler) {
    this.resultHandlerQueue.push({resolve: resolve, reject: reject});
  }
}
