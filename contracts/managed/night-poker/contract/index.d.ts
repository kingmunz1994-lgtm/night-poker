import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  localSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  myCard0(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  myCard1(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  myCardCommit(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  rakeComputed(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
}

export type ImpureCircuits<PS> = {
  createTable(context: __compactRuntime.CircuitContext<PS>,
              bigBlind_0: bigint,
              smallBlind_0: bigint,
              maxBuyin_0: bigint,
              rakeBps_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  joinTable(context: __compactRuntime.CircuitContext<PS>, buyIn_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  startHand(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
  dealCards(context: __compactRuntime.CircuitContext<PS>,
            playerCommit_0: Uint8Array,
            cardCommit_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  placeBet(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  foldHand(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
  advancePhase(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
  revealHand(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
  awardPot(context: __compactRuntime.CircuitContext<PS>,
           winnerCommit_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
}

export type ProvableCircuits<PS> = {
  createTable(context: __compactRuntime.CircuitContext<PS>,
              bigBlind_0: bigint,
              smallBlind_0: bigint,
              maxBuyin_0: bigint,
              rakeBps_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  joinTable(context: __compactRuntime.CircuitContext<PS>, buyIn_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  startHand(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
  dealCards(context: __compactRuntime.CircuitContext<PS>,
            playerCommit_0: Uint8Array,
            cardCommit_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  placeBet(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  foldHand(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
  advancePhase(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
  revealHand(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
  awardPot(context: __compactRuntime.CircuitContext<PS>,
           winnerCommit_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  createTable(context: __compactRuntime.CircuitContext<PS>,
              bigBlind_0: bigint,
              smallBlind_0: bigint,
              maxBuyin_0: bigint,
              rakeBps_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  joinTable(context: __compactRuntime.CircuitContext<PS>, buyIn_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  startHand(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
  dealCards(context: __compactRuntime.CircuitContext<PS>,
            playerCommit_0: Uint8Array,
            cardCommit_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  placeBet(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
  foldHand(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
  advancePhase(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
  revealHand(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
  awardPot(context: __compactRuntime.CircuitContext<PS>,
           winnerCommit_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
}

export type Ledger = {
  big_blind: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  small_blind: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  max_buyin: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  rake_bps: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  game_phase: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  pot: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  player_count: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  hand_number: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  dealer_commit: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  player_stack: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  player_bet: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  player_active: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  player_folded: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  player_card_commit: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  player_revealed: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  player_card0: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  player_card1: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
