'use babel'

/* @flow */

declare module 'debugger' {

  declare type FunctionBreakpoint = { function: string }
  declare type LineBreakpoint     = { filePath: string, bufferRow: number }
  declare type BreakpointLocation = LineBreakpoint | FunctionBreakpoint

  declare interface Breakpoint {
    location:        BreakpointLocation;
    enabled:         boolean;
    condition:       ?string;
    activeBufferRow: ?number;

    constructor(location: BreakpointLocation, condition?: string): void;

    getLocation(): BreakpointLocation;

    isEnabled(): bool;

    equals(other: Breakpoint): bool;
  }

  declare type BreakpointEventType  = 'inserted' | 'removed' | 'enabled' |
                                      'disabled' | 'moved' |
                                      'condition-added' | 'condition-removed'

  declare interface BreakpointEvent {
    type:       BreakpointEventType;
    breakpoint: Breakpoint;
    bufferRow:  ?number;

    constructor(
      type: BreakpointEventType, breakpoint: Breakpoint, bufferRow?: number): void;
  }

  declare type SessionEventType         = 'launched' | 'will-terminate' |
                                          'terminated' | 'resumed' | 'suspended'
  declare type SessionTerminationReason = 'normally' | 'interrupt'
  declare type SessionSuspensionReason  = 'breakpoint' | 'step'

  declare type ExecutionLine = { filePath: string, bufferRow: number }

  declare class SessionEvent {
    type:          SessionEventType;
    reason:        SessionTerminationReason | SessionSuspensionReason;
    executionLine: ExecutionLine;

    constructor(
      type:           SessionEventType,
      reason?:        SessionTerminationReason | SessionSuspensionReason,
      executionLine?: ExecutionLine): void;
  }

  declare type TargetEventType = 'output'

  declare class TargetEvent {
    type: TargetEventType;
    message: string;

    constructor(type: TargetEventType, message: string): void;
  }

  declare interface EventDefs {
    BreakpointEvent: BreakpointEvent;
    SessionEvent:    SessionEvent;
    TargetEvent:     TargetEvent;
  }

  declare type StackFrame = {
    level: number,
    address: string,
    function: string,
    filePath: string,
    bufferRow: number
  }

  declare type Variable = {
    name: string,
    value: string,
    type: ?string
  }

  declare interface DebuggerTarget  {
    filePath: string,
    args: ?string[]
  }
}
