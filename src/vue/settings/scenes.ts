import { GuiScenes, UISceneNames } from '@/types';
import { BattleScene, GalaxyScene, StartScene } from '@/scenes';
import {
  BattleAcceptMode,
  BattleCoinsMode,
  BattleConnectMode,
  BattleLoadingMode,
  BattleResultsMode,
  BattleRewardsMode,
  PlayerPickMode,
  PreGameCounterMode,
  PhantomMode,
  PreloaderMode,
  RealMode,
  WelcomeMode
} from '@/modes';
import { BattleInitMode, BattleProcessMode } from '@/modes';
import { default as anime } from 'animejs';
import { useBattleStore } from '@/stores';


export const SCENES: GuiScenes = {
  start: {
    name: UISceneNames.Start,
    getComponent: () => StartScene,
    modes: [
      {
        name: 'preloader',
        getComponent: () => PreloaderMode,
      },
      {
        name: 'welcome',
        getComponent: () => WelcomeMode,
      },
    ],
    initialMode: 'preloader'
  },
  galaxy: {
    name: UISceneNames.Galaxy,
    getComponent: () => GalaxyScene,
    modes: [
      {
        name: 'phantom',
        label: 'Phantom',
        getComponent: () => PhantomMode,
        enabled: true,
      },
      {
        name: 'real',
        label: 'Real',
        getComponent: () => RealMode,
        clientScenes: [
          {
            name: 'galaxy',
            label: 'Galaxy',
            enabled: true,
            clickable: true
          },
          {
            name: 'star',
            label: 'Star',
            enabled: true,
            clickable: false,
          },
          {
            name: 'planet',
            label: 'Planet',
            enabled: false,
            clickable: false
          }
        ],
        enabled: true,
      },
      {
        name: 'season',
        label: 'Season',
        getComponent: () => null,
        enabled: false
      }
    ],
    initialMode: 'real'
  },
  battle: {
    name: UISceneNames.Battle,
    getComponent: () => BattleScene,
    modes: [
      {
        name: 'init',
        getComponent: () => BattleInitMode,
        onEnter: async (el) => {
          const top = el.querySelector('.BattleInitMode__top')
          const bottom = el.querySelector('.BattleInitMode__bottom')
          const vs = el.querySelector('.BattleInitMode__vs')

          const timeline = anime.timeline({
            easing: 'easeInOutQuart',
            duration: 800,
            delay: 100,
          });

          await timeline.add({
            targets: vs,
            opacity: [0, 1],
            scale: [0.5, 1],
          }).add({
            targets: top,
            translateY: ['-100%', 0],
          }, 0).add({
            targets: bottom,
            translateY: ['100%', 0],
          }, 0).finished
        },
        beforeLeave: async (el) => {
          const top = el.querySelector('.BattleInitMode__top')
          const bottom = el.querySelector('.BattleInitMode__bottom')
          const vs = el.querySelector('.BattleInitMode__vs')

          const timeline = anime.timeline({
            easing: 'easeInCubic',
            duration: 600,
          });

          await timeline.add({
            targets: vs,
            opacity: [1, 0],
            scale: [1, 0.5],
          }).add({
            targets: top,
            translateY: [0, '-100%'],
          }, 0).add({
            targets: bottom,
            translateY: [0, '100%'],
          }, 0).finished
        },
      },
      {
        name: 'accept',
        getComponent: () => BattleAcceptMode,
      },
      {
        name: 'connect',
        getComponent: () => BattleConnectMode,
      },
      {
        name: 'loading',
        getComponent: () => BattleLoadingMode,
      },
      {
        name: 'playerPick',
        getComponent: () => PlayerPickMode,
      },
      {
        name: 'preGameCounter',
        getComponent: () => PreGameCounterMode,
      },
      {
        name: 'process',
        getComponent: () => BattleProcessMode,
        onEnter: async (el) => {
          await anime({
            targets: el,
            easing: 'easeInOutQuart',
            duration: 400,
            opacity: [0, 1],
          }).finished
        },
        beforeLeave: async (el) => {
          await anime({
            targets: el,
            easing: 'easeInOutQuart',
            duration: 400,
            opacity: [1, 0],
          }).finished
        }
      },
      {
        name: 'results',
        getComponent: () => BattleResultsMode,
        onEnter: async (el) => {
          await anime({
            targets: el,
            easing: 'easeInOutQuart',
            duration: 400,
            opacity: [0, 1],
          }).finished
        },
      },
      {
        name: 'rewards',
        getComponent: () => BattleRewardsMode,
        onEnter: async (el) => {
          await anime({
            targets: el,
            easing: 'easeInOutQuart',
            duration: 400,
            opacity: [0, 1],
          }).finished
        },
      },
      {
        name: 'coins',
        getComponent: () => BattleCoinsMode,
        onEnter: async (el) => {
          await anime({
            targets: el,
            easing: 'easeInOutQuart',
            duration: 400,
            opacity: [0, 1],
          }).finished
        },
      },
    ],
    initialMode: 'playerPick',
    afterLeave: () => {
      useBattleStore().process.reset()
    }
  },
};
