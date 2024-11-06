import { Handler, default as mitt } from 'mitt';
import { BaseProvider } from '@/services/wallet/providers/base-provider';
import { ReaderProvider } from '@/services/wallet/providers/reader-provider';
import { WalletStoreState, useBattleStore, useWalletStore } from '@/stores';
import { markRaw, watch } from 'vue';
import { UniversalProvider } from './providers/universal-provider';
import { InitWalletconnectModal } from '~/blockchain/walletconnect/auth';
import { BlockchainConnectService } from '~/blockchain';
import { getShortAddress } from '@/utils';

let walletInstance: WalletService | null = null

export class WalletService {
  account = '';
  login = '';
  connected = false;
  installed = false;
  currency = 'plasma';
  provider: BaseProvider = new ReaderProvider();
  emmiter = mitt()

  constructor() {
    walletInstance = this
  }

  get state(): WalletStoreState {
    return {
      account: this.account,
      login: this.login,
      connected: this.connected,
      installed: this.installed,
    }
  }

  async connect(provider: 'metamask' | 'walletconnect' | 'telegram' | 'local' | 'TON') {
    if (provider === 'metamask') {
      this.provider = new UniversalProvider()
    }

    if (provider === 'walletconnect') {
      InitWalletconnectModal();
      this.provider = new UniversalProvider()
    }

    if (provider === 'telegram' || provider === 'local' || provider === 'TON') {
      this.provider = new UniversalProvider()
    }

    if (!this.provider) {
      throw new Error('provider not defined')
    }

    useBattleStore().rewards.setBoxesIds(
      await this.provider.getUserBoxesToOpen()
    );

    return this.updateState((await this.provider.connect()).value);
  }

  private updateState(account: string | null) {
    this.installed = account !== null;

    if (!account) {
      this.emmiter.emit('state', this.state)

      return false;
    }

    const connectService = BlockchainConnectService.getInstance()

    this.connected = true;
    this.account = account;
    this.login = connectService.telegramLogin() || getShortAddress(account);
    this.emmiter.emit('state', this.state)

    return true;
  }

  on(type: string, handler: Handler<unknown>) {
    this.emmiter.on(type, handler)
  }

  openPopup() {
    return new Promise(resolve => {
      const store = useWalletStore()

      const unwatch = watch(() => store.popup, () => {
        if (!store.popup) {
          resolve(this.state)
          unwatch()
        }
      })

      store.openPopup()
    })
  }

  static getWalletInstance() {
    return walletInstance || new WalletService()
  }

  static VuePlugin = {
    install: app => {
      app.config.globalProperties.$wallet = markRaw(WalletService.getWalletInstance());
    }
  };

  static StorePlugin = () => ({
    wallet: markRaw(WalletService.getWalletInstance())
  });
}

export const useWallet = () => WalletService.getWalletInstance()
