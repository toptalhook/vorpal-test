import { Race } from "../../blockchain/types";

export type BattleActionType = 'satelliteFire' | 'rocketFire' | 'slowdown' | 'invisibility' | 'tower' | 'star' | 'ship' | 'linkor';

export type BattleItemStatusType = {
  id: number
  hide: boolean
  special: boolean
  detail: boolean
  buy: boolean
}

export type BattleTutorialContentType = {
  step: string,
  description: string,
  imagePath: string
}

export type BattleItemCardType = {
  name: string,
  price: number,
  description: string,
  src: string, 
}

export type ItemTradingType =  {
  id: number,
  buy: boolean,
}

export type BattlePlayer = {
  address: string
  star: string
  name: string
  race: Race
  isNick: boolean
}

export type BattleConnectedUsers = {
  current: number
  max: number
}

export type BattleSkill = {
  level: number,
  levelUpAvailable: boolean,
  cooldown: {
    duration: number,
  }
}

export type BattleData = {
  players: {
    current: BattlePlayer,
    connected: BattlePlayer,
  },
  level: {
    current: number,
    progress: number
  },
  gold: number,
  skills: {
    [K in BattleActionType]?: BattleSkill
  }
}

export type BattleResults = {
  type: 'victory' | 'defeat'
  enemyName: string
  enemyLevel: number
  player: string
  playerLevel: number
  owner: string
  damage: number
  gold: number
  exp: number
  rating: {
    previous: number
    current: number
  },
  box: {
    show: boolean,
    level: number
  },
  claim: {
    show: boolean
  }
}

export type BattleCooldown = {
  [K in BattleActionType]?: null | {
    duration: number
    progress: number
  }
}

export type BattleActiveCooldown = {
  [K in BattleActionType]?: anime.AnimeInstance
}

export type BattleActionPayload = {
  action: BattleActionType
  type: 'call' | 'levelUp'
}

export type BattleReward = {
  name: string,
  image: string
  rare: string
  value?: number
}
