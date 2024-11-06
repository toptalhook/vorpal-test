import { Ref } from "vue";
import { BlockchainConnectService } from "~/blockchain";
import { getLaserLevel } from "~/blockchain/getters/boxes";
import { getBoxDataWeb2, getUserBoxesToOpenWeb2 } from "~/blockchain/getters/boxesWeb2";
import { GetCreationCost, GetSingleStarData, GetStarDataFromServer, GetStarsCount, getWeb2StarDataFromServer, RequiredPlasmaToApprove } from "~/blockchain/getters/stars";
import { GetAllowance, GetBalance } from "~/blockchain/getters/tokens";
import { Coords, StarData, StarList, fuelTarget } from "~/blockchain/types";

export abstract class BaseProvider {
  abstract account: Ref<string>

  abstract connect(): Promise<Ref<string | null>>

  abstract approvePlasma(amount: number): Promise<any>

  abstract createStar(name: string, coords: Coords): Promise<any>

  abstract refuelStar(starId: number, amount: number, target: fuelTarget): Promise<any>

  abstract refuelStarLevelUp(starId: number, amount: number): Promise<any>

  abstract refuelStarExistence(starId: number, amount: number): Promise<any>

  abstract increaseStarLevel(starId: number): Promise<any>

  abstract mintPlasma(amount: number): Promise<any>

  abstract openBox(boxId: number): Promise<any>
  
  async getUserBoxesToOpen() {
    return this.checkConnection(() => getUserBoxesToOpenWeb2(this.account.value), []);
  }

  async getUserAssets() {
    try {
      return await BlockchainConnectService.getInstance().getUserAssets()
    } catch (error) {
      return []
    }
  }

  async getBoxData(boxId: number) {
    return this.checkConnection(() => getBoxDataWeb2(boxId));
  }

  async getLaserLevel(laserId: number) {
    return this.checkConnection(() => getLaserLevel(laserId));
  }

  async getAllowance() {
    return this.checkConnection(() => GetAllowance(this.account.value));
  }

  async getBalance() {
    return this.checkConnection(() => GetBalance(this.account.value), 0);
  }

  async getCreationCost(level = 1) {
    return GetCreationCost(level) || 0;
  }

  async getStars(): Promise<StarList> {
    // return GetAllStarData();
    return GetStarDataFromServer();
    // return getWeb2StarDataFromServer();
  }

  async getStarById(starId: number): Promise<StarData> {
    return GetSingleStarData(starId);
  }

  async getStarsCount(): Promise<number> {
    return GetStarsCount();
  }

  async requiredPlasmaToApprove() {
    return this.checkConnection(() => RequiredPlasmaToApprove(this.account.value));
  }

  protected async checkConnection<T extends (...args: unknown[]) => ReturnType<Awaited<T>>>(
    method: T,
    defaultValue?: Awaited<ReturnType<T>>
  ) {
    return (await this.connect()) ? method() : defaultValue;
  }
}
