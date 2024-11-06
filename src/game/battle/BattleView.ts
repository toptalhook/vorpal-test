import * as THREE from 'three';
import gsap from 'gsap';
import { GUI } from 'dat.gui';
import { MyEventDispatcher } from "../basics/MyEventDispatcher";
import { IUpdatable } from "../core/interfaces/IUpdatable";
import { BattleObject } from '../objects/battle/BattleObject';
import { BattleStar } from '../objects/battle/BattleStar';
import { BattlePlanet } from '../objects/battle/BattlePlanet';
import { Fighter } from '../objects/battle/Fighter';
import { LaserLine } from '../objects/battle/LaserLine';
import { MyMath } from '../../monax/MyMath';
import { BattleCameraMng } from './BattleCameraMng';
import { ObjectHpViewer } from './ObjectHpViewer';
import { Linkor } from '../objects/battle/Linkor';
import { FieldInitData, PlanetLaserData, ObjectCreateData, ObjectType, ObjectUpdateData, PackTitle, AttackData, DamageData, PlanetLaserSkin, ExplosionData, SniperData, ObjectRace, RocketPacket, ExpTextData, GoldTextData } from './Types';
import { BattleConnection } from './BattleConnection';
import { FieldCell } from '../objects/battle/FieldCell';
import { LogMng } from '../../monax/LogMng';
import { ThreeUtils } from '../utils/threejs/ThreejsUtils';
import { DamageViewer } from './DamageViewer';
import { Tower } from '../objects/battle/Tower';
import { HomingMissile } from '../objects/battle/HomingMissile';
import { Explosion } from '../objects/Explosion';
import { InputMng } from '../utils/inputs/InputMng';
import { ClickableMesh } from '../objects/basic/ClickableMesh';
import { GameEventDispatcher } from '../events/GameEvents';
import { DeviceInfo } from '../utils/DeviceInfo';
import { Renderer } from '../core/renderers/Renderer';
import { AudioMng } from '../audio/AudioMng';
import { AudioAlias } from '../audio/AudioData';
import { RocketTargetViewer } from './RocketTargetViewer';
import { TextViewer } from './TextViewer';
import { GlobalParams } from '../data/GlobalParams';

type ServerFieldParams = {

}

const SETTINGS = {

    server: {
        field: {
            size: {
                cols: 8,
                rows: 10,
                sectorWidth: 10,
                sectorHeight: 9,
                w: 8 * 10,
                h: 10 * 9
            },
        },

    },

    client: {
        field: {
            size: {
                w: 80,
                h: 100
            }
        }
    },

    sunLights: true,
    
    dirLights: false,
    directionLight: {
        color: 0xffffff,
        intens: 1,
        pos: {
            x: -100,
            y: 100,
            z: 0
        }
    },

    // stars params
    stars: {
        light: {
            height: 6,
            intens: 1.,
            dist: 60,
            decay: .1
        }
    },

    // tower params
    towers: {
        light: {
            height: 0,
            intens: 1,
            dist: 22,
            decay: .2,
            ownerColor: 0x0000ff,
            enemyColor: 0xff0000,
        }
    }

}

const DEBUG_GUI = {
    showAxies: false,
    showObjectRadius: false,
    showObjectAttackRadius: false,
    lightHelpers: false,
    showMyDamage: false
}

export class BattleView extends MyEventDispatcher implements IUpdatable {
    private _walletAddr: string;
    private _render: Renderer;
    private _scene: THREE.Scene;
    private _camera: THREE.Camera;
    private _raycaster: THREE.Raycaster;
    private _connection: BattleConnection;
    private _cameraTarget: THREE.Vector3;
    private _cameraMng: BattleCameraMng;

    private _playerRace: ObjectRace;
    private _enemyRace: ObjectRace;

    private _dummyMain: THREE.Group;
    private _objects: Map<number, BattleObject>;

    private _objectHpViewer: ObjectHpViewer;
    private _damageViewer: DamageViewer;
    private _textViewer: TextViewer;
    private _attackRays: { [index: string]: LaserLine } = {};
    private _explosionSystem: Explosion;
    private _rocketTargetViewer: RocketTargetViewer;

    private _isTopPosition = false;
    private _axiesHelper: THREE.AxesHelper;
    private _fieldCells: FieldCell[];

    constructor(aParams: {
        render: Renderer,
        scene: THREE.Scene,
        camera: THREE.Camera,
        connection: BattleConnection
    }) {
        super('BattleView');

        this._render = aParams.render;
        this._scene = aParams.scene;
        this._camera = aParams.camera;
        this._connection = aParams.connection;

        this._cameraTarget = new THREE.Vector3();
        this._cameraMng = new BattleCameraMng({
            camera: this._camera,
            cameraTarget: this._cameraTarget
        });

        this._dummyMain = new THREE.Group();
        this._scene.add(this._dummyMain);

        this._objects = new Map();
        this._objectHpViewer = new ObjectHpViewer(this._dummyMain);
        this._damageViewer = new DamageViewer(this._dummyMain, this._camera);
        this._textViewer = new TextViewer(this._dummyMain, this._camera);
        this._rocketTargetViewer = new RocketTargetViewer(this._dummyMain);

        this._explosionSystem = new Explosion({
            parent: this._dummyMain,
            camera: this._camera
        });

        this.initDirectionLight();
        this.initConnectionListeners();
        this.initRaycaster();
        this.initInput();
        
    }

    private initDirectionLight() {
        if (!SETTINGS.dirLights) return;
        const set = SETTINGS.directionLight;
        let dir = new THREE.DirectionalLight(set.color, set.intens);
        dir.position.set(set.pos.x, set.pos.y, set.pos.z);
        let amb = new THREE.AmbientLight(0x0, 0.5);
        this._scene.add(dir);
        this._scene.add(amb);
    }

    private initRaycaster() {
        this._raycaster = new THREE.Raycaster();
    }

    private initConnectionListeners() {
        this._connection.socket.on(PackTitle.fieldInit, (aData: FieldInitData) => {
            this.logDebug(`PackTitle.fieldInit recv...`);
            this.onFieldInitPack(aData);
        });
        this._connection.socket.on(PackTitle.objectCreate, (aData) => {
            this.onObjectCreatePack(aData);
        });
        this._connection.socket.on(PackTitle.objectUpdate, (aData) => {
            this.onObjectUpdatePack(aData);
        });
        this._connection.socket.on(PackTitle.objectDestroy, (aIds: number[]) => {
            this.onObjectDestroyPack(aIds);
        });
        this._connection.socket.on(PackTitle.rotate, (aData) => {
            this.onRotatePack(aData);
        });
        this._connection.socket.on(PackTitle.jump, (aData) => {
            this.onJumpPack(aData);
        });
        this._connection.socket.on(PackTitle.attack, (aData: AttackData) => {
            this.attackPack(aData);
        });
        this._connection.socket.on(PackTitle.rayStart, (aData) => {
            this.rayStart(aData);
        });
        this._connection.socket.on(PackTitle.rayStop, (aData) => {
            this.stopRay(aData.idFrom);
        });
        this._connection.socket.on(PackTitle.damage, (aData: DamageData) => {
            this.onDamagePack(aData);
        });
        this._connection.socket.on(PackTitle.goldText, (aData: GoldTextData) => {
            this.onGoldTextPack(aData);
        });

        // skills
        this._connection.socket.on(PackTitle.planetLaser, (aData: PlanetLaserData) => {
            this.planetLaser(aData);
        });
        this._connection.socket.on(PackTitle.rocket, (aData: RocketPacket) => {
            this.onRocketPacket(aData);
        });
        this._connection.socket.on(PackTitle.sniper, (aData: SniperData) => {
            this.onSniperPack(aData);
        });

        // effects
        this._connection.socket.on(PackTitle.explosion, (aData: ExplosionData) => {
            this.onExplosionPack(aData);
        });
    }

    private removeConnectionListeners() {
        this._connection.socket.removeListener(PackTitle.fieldInit);
        this._connection.socket.removeListener(PackTitle.objectCreate);
        this._connection.socket.removeListener(PackTitle.objectUpdate);
        this._connection.socket.removeListener(PackTitle.objectDestroy);
        this._connection.socket.removeListener(PackTitle.rotate);
        this._connection.socket.removeListener(PackTitle.jump);
        this._connection.socket.removeListener(PackTitle.attack);
        this._connection.socket.removeListener(PackTitle.rayStart);
        this._connection.socket.removeListener(PackTitle.rayStop);
        this._connection.socket.removeListener(PackTitle.damage);
        this._connection.socket.removeListener(PackTitle.goldText);
        // skills
        this._connection.socket.removeListener(PackTitle.planetLaser);
        this._connection.socket.removeListener(PackTitle.rocket);
        this._connection.socket.removeListener(PackTitle.sniper);
        // effects
        this._connection.socket.removeListener(PackTitle.explosion);
    }

    private initInput() {
        let inputMng = InputMng.getInstance();
        inputMng.onClickSignal.add(this.onClick, this);
    }

    private removeInput() {
        let inputMng = InputMng.getInstance();
        inputMng.onClickSignal.remove(this.onClick, this);
    }

    private onClick(aClientX: number, aClientY: number) {

        let inMng = InputMng.getInstance();
        let pos = {
            x: aClientX,
            y: aClientY
        }

        let star = this.getStarUnderPoint(inMng.normalDown);
        if (star) {

        }

    }

    private getStarUnderPoint(normalCoords: any): BattleStar {

        let res: BattleStar;

        // get all stars
        let stars = this.getObjectsByType('Star');

        for (let i = 0; i < stars.length; i++) {
            const star = stars[i];
            // star.mesh
        }

        this._raycaster.setFromCamera(normalCoords, this._camera);
        const intersects = this._raycaster.intersectObjects(this._scene.children, true);

        for (let i = 0; i < intersects.length; i++) {
            const obj = intersects[i].object;
            if (obj instanceof ClickableMesh) {
                obj.generateClickEvent();
            }
        }

        return res;

    }

    private initField() {
        const fSize = SETTINGS.server.field.size;

        this._fieldCells = [];

        for (let cy = 0; cy < fSize.rows; cy++) {
            for (let cx = 0; cx < fSize.cols; cx++) {
                let fieldCell = new FieldCell(4);
                this._fieldCells.push(fieldCell);
                fieldCell.position.copy(this.getPosByCellPos({ x: cx, y: cy }));
                this._dummyMain.add(fieldCell);
            }
        }

    }

    private clearFieldCells() {
        this._fieldCells.forEach(cell => cell.free());
        this._fieldCells = [];
    }

    private initCameraPosition(aIsTop: boolean) {
        const H = 170;
        let zFactor = aIsTop ? -1 : 1;
        this._cameraMng.moveTo({
            aCamPos: { x: 0, y: H, z: 10 * zFactor },
            aTargetPos: { x: 0, y: 0, z: 9 * zFactor },
            duration: .5
        });
        // this._camera.position.set(0, H, 25 * zFactor);
        // this._camera.lookAt(0, 0, 20 * zFactor);
    }

    private serverValueToClient(aServerValue: number): number {
        const factor = SETTINGS.client.field.size.w / SETTINGS.server.field.size.w;
        return aServerValue * factor;
    }

    private serverToClientX(aServerX: number): number {
        const factor = SETTINGS.client.field.size.w / SETTINGS.server.field.size.w;
        const wh = SETTINGS.client.field.size.w / 2;
        const dx = SETTINGS.server.field.size.sectorWidth / 2 * factor;
        return aServerX * factor - wh + dx;
    }

    private serverToClientY(aServerY: number): number {
        const factor = SETTINGS.client.field.size.h / SETTINGS.server.field.size.h;
        const h = SETTINGS.client.field.size.h / 2;
        const dy = SETTINGS.server.field.size.sectorHeight / 2 * factor;
        return aServerY * factor - h + dy;
    }

    private getPositionByServer(aServerPos: { x: number, y: number }): THREE.Vector3 {
        return new THREE.Vector3(
            this.serverToClientX(aServerPos.x),
            0,
            this.serverToClientY(aServerPos.y),
        );
    }

    private getPositionByServerV3(aV3: { x: number, y: number, z: number }): THREE.Vector3 {
        return new THREE.Vector3(
            this.serverToClientX(aV3.x),
            0,
            this.serverToClientY(aV3.z)
        );
    }

    private getPosByCellPos(aCellPos: { x: number, y: number }): THREE.Vector3 {
        const fx = SETTINGS.server.field.size.sectorWidth;
        const fy = SETTINGS.server.field.size.sectorHeight;
        const dx = aCellPos.y % 2 === 0 ? 0 : fx / 2;
        return new THREE.Vector3(
            this.serverToClientX(aCellPos.x * fx + dx),
            0,
            this.serverToClientY(aCellPos.y * fy),
        );
    }

    private getObjectById(aId: number): BattleObject {
        return this._objects.get(aId);
    }

    private getObjectsByType(aType: ObjectType): BattleObject[] {
        let res: BattleObject[] = [];
        this._objects.forEach(obj => {
            if (obj.objType == aType) {
                res.push(obj);
            }
        });
        return res;
    }

    private isCurrentOwner(aWalletAddr: string): boolean {
        return this._walletAddr == aWalletAddr;
    }

    private getRaceForWalletAddr(aWalletAddr: string): ObjectRace {
        return this.isCurrentOwner(aWalletAddr) ? this._playerRace : this._enemyRace;
    }

    private getPlanetLaserColor(aSkin: PlanetLaserSkin): string {
        let color = '#0072ff';
        switch (aSkin) {
            case 'blue':
                color = '#0072ff';
                break;
            case 'red':
                color = '#ff0000';
                break;
            case 'white':
                color = '#ffffff';
                break; 
            case 'violet':
                color = '#ba00ff';
                break;
        }
        return color;
    }

    private getShipLaserColor(aOwner: string): string {
        return this.isCurrentOwner(aOwner) ? '#0072ff' : '#ff0000';
    }

    private getRandomShip(exclude?: BattleObject[]): BattleObject {
        let ships: BattleObject[] = [];
        this._objects.forEach((aObj) => {
            if (aObj instanceof Fighter) ships.push(aObj);
        })
        if (ships.length <= 0) return null;
        let id = MyMath.randomIntInRange(0, ships.length - 1);
        return ships[id];
    }
    
    private onFieldInitPack(aData: FieldInitData) {

        // update wallet number
        // this._walletAddr = BlockchainConnectService.getInstance().getWalletAddress();
        this._walletAddr = aData.playerWalletAddr;
        this.logDebug(`onFieldInitPack: _walletAddr = ${this._walletAddr}`);

        SETTINGS.server.field = aData.fieldParams;
        let fieldSize = SETTINGS.server.field.size;
        fieldSize.w = fieldSize.cols * fieldSize.sectorWidth;
        fieldSize.h = fieldSize.rows * fieldSize.sectorHeight;
        this.initField();

        this._playerRace = aData.playerRace;
        this._enemyRace = aData.enemyRace;

        // setTimeout(() => {
            this._isTopPosition = aData.playerPosition == 'top';
            this._objectHpViewer.isTopViewPosition = this._isTopPosition;
            this.initCameraPosition(this._isTopPosition);
        // }, 1000);

    }

    private onObjectCreatePack(aData: ObjectCreateData) {
        let obj: BattleObject;

        // this.logDebug(`onObjectCreatePack(): ${aData.type}:`, aData);

        switch (aData.type) {

            case 'Star':
                obj = new BattleStar({
                    ...aData,
                    ...{
                        camera: this._camera,
                        planetOrbitRadius: 15,
                        light: SETTINGS.sunLights ? {
                            parent: this._dummyMain,
                            ...SETTINGS.stars.light
                        } : null
                    }
                });
                if (aData.pos) obj.position.copy(this.getPositionByServer({ x: aData.pos.x, y: aData.pos.z }));
                this._objects.set(aData.id, obj);
                (obj as BattleStar).onClick.add(this.onStarClick, this);
                break;

            case 'Planet':
                obj = new BattlePlanet(aData);
                if (aData.pos) obj.position.copy(this.getPositionByServer({ x: aData.pos.x, y: aData.pos.z }));
                if (aData.q) {
                    obj.setQuaternion(aData.q);
                    obj.setTargetQuaternion(aData.q);
                }
                this._objects.set(aData.id, obj);
                break;
            
            case 'Tower':
                this.createTower(aData);
                break;

            case 'FighterShip':
                this.createFighter(aData);
                break;

            case 'BattleShip':
                this.createLinkor(aData);
                break;

            case 'HomingMissile': {
                this.createHomingMissile(aData);

                // MASS TEST
                // const iskomId = aData.id;
                // for (let i = 0; i < 100; i++) {
                //     setTimeout(() => {
                //         const id = iskomId + 10000 + i;
                //         aData.id = id;
                //         this.createHomingMissile(aData);
                //         setTimeout(() => {
                //             this.destroyObject(id);
                //         }, 3000 + i * 100);
                //     }, 10 * i);
                // }

                // add hp bar
                // this._objectHpViewer.addBar(obj);
                
            } break;

            default:
                this.logWarn(`createObject(): unknown obj type:`, aData);
                break;

        }

        if (obj) {
            this._dummyMain.add(obj);
            this._objects.set(aData.id, obj);
        }
    }
    
    private onStarClick(aStar: BattleStar) {
        if (this.isCurrentOwner(aStar.owner)) {
            let pos2d = ThreeUtils.toScreenPosition(this._render.renderer, aStar, this._camera,
                Math.min(2, DeviceInfo.getInstance().devicePixelRatio));
            GameEventDispatcher.showEmotionSelection(pos2d);
        }
    }

    private onObjectUpdatePack(aData: ObjectUpdateData[]) {
        for (let i = 0; i < aData.length; i++) {
            const data = aData[i];

            let obj = this._objects.get(data.id);
            if (!obj) {
                this.logError(`updateObject: !obj for data:`, data);
                return;
            }

            if (data.pos) {
                obj.targetPosition = {
                    x: this.serverToClientX(data.pos.x),
                    z: this.serverToClientY(data.pos.z)
                }
            }

            if (data.q) {
                obj.setTargetQuaternion(data.q);
            }

            if (data.hp != undefined) {
                obj.hp = data.hp;
            }

            if (data.shield != undefined) {
                obj.shield = data.shield;
            }

        }

    }

    private onObjectDestroyPack(aIds: number[]) {
        for (let i = 0; i < aIds.length; i++) {
            this.destroyObject(aIds[i]);
        }
    }

    private onRotatePack(aData: {
        id: number,
        type: 'toPoint' | 'toDir',
        target: { x, y, z },
        duration: number
    }) {
        let obj = this.getObjectById(aData.id);
        if (!obj) {
            this.logWarn(`rotate: !obj`, aData);
            return;
        }
        switch (aData.type) {
            case 'toPoint':
                obj.rotateToPoint(this.getPositionByServerV3(aData.target), aData.duration);
                break;
        }
    }

    private onJumpPack(aData: {
        id: number,
        pos: { x, y, z },
        duration: number
    }) {
        let obj = this.getObjectById(aData.id);
        if (!obj) {
            this.logWarn(`jump: !obj`, aData);
            return;
        }
        // obj.rotateToPoint(this.getPositionByServerV3(aData.target), aData.duration);
        // let pos = this.getPositionByServerV3(aData.pos);
        // obj.position.copy(pos);
        obj.jumpToPoint(this.getPositionByServerV3(aData.pos), aData.duration);

    }

    private onDamagePack(aData: DamageData) {
        let obj = this.getObjectById(aData.id);
        if (this.isCurrentOwner(obj?.owner) && !DEBUG_GUI.showMyDamage) {
            return;
        }
        let pos = this.getPositionByServerV3(aData.pos);
        this._damageViewer.showDamage(pos, aData.info);
    }

    private onGoldTextPack(aData: GoldTextData) {
        let pos = this.getPositionByServerV3(aData.pos);
        this._textViewer.showText({
            pos: pos,
            text: `+${aData.gold} G`,
            color: 0xF9EB21
        });
    }

    private createTower(aData: ObjectCreateData) {

        let obj = new Tower({
            ...aData,
            ...{
                race: this.getRaceForWalletAddr(aData.owner),
                // light: {
                //     parent: this._dummyMain,
                //     ...SETTINGS.towers.light,
                //     color: this.isCurrentOwner(aData.owner) ? SETTINGS.towers.light.ownerColor : SETTINGS.towers.light.enemyColor
                // },
                showRadius: DEBUG_GUI.showObjectRadius,
                showAttackRadius: DEBUG_GUI.showObjectAttackRadius
            }
        });

        if (aData.pos) {
            const clientPos = this.getPositionByServer({ x: aData.pos.x, y: aData.pos.z });
            obj.position.copy(clientPos);
        }

        if (aData.q) {
            obj.setQuaternion(aData.q);
            obj.setTargetQuaternion(aData.q);
        }

        // hp bar
        this._objectHpViewer.addBar(obj, !this.isCurrentOwner(aData.owner));

        this._dummyMain.add(obj);
        this._objects.set(aData.id, obj);

        return obj;
    }

    private createFighter(aData: ObjectCreateData): BattleObject {
        let obj = new Fighter({
            ...aData,
            ...{
                highlighting: {
                    active: true,
                    isEnemy: !this.isCurrentOwner(aData.owner),
                },
                race: this.getRaceForWalletAddr(aData.owner),
                showRadius: DEBUG_GUI.showObjectRadius,
                showAttackRadius: DEBUG_GUI.showObjectAttackRadius
            }
        });

        if (!obj) {
            this.logError(`createFighter: obj == NULL`);
            return;
        }

        // position
        if (aData.pos) {
            const clientPos = this.getPositionByServer({ x: aData.pos.x, y: aData.pos.z });
            obj.position.copy(clientPos);
        }

        // rotation by quaternion
        if (aData.q) {
            obj.setQuaternion(aData.q);
            obj.setTargetQuaternion(aData.q);
        }

        if (aData.lookDir) obj.lookByDir(aData.lookDir);

        // hp bar
        this._objectHpViewer.addBar(obj, !this.isCurrentOwner(aData.owner));
        
        // sfx
        AudioMng.getInstance().playSfx({ alias: AudioAlias.battleCreepSpawn, volume: .15 });

        this._dummyMain.add(obj);
        this._objects.set(aData.id, obj);

        return obj;
    }

    private createLinkor(aData: ObjectCreateData) {
        let obj = new Linkor({
            ...aData,
            ...{
                highlighting: {
                    active: true,
                    isEnemy: !this.isCurrentOwner(aData.owner),
                },
                race: this.getRaceForWalletAddr(aData.owner),
                showRadius: DEBUG_GUI.showObjectRadius,
                showAttackRadius: DEBUG_GUI.showObjectAttackRadius
            }
        });

        if (aData.pos) {
            const clientPos = this.getPositionByServer({ x: aData.pos.x, y: aData.pos.z });
            obj.position.copy(clientPos);
        }

        if (aData.q) {
            obj.setQuaternion(aData.q);
            obj.setTargetQuaternion(aData.q);
        }

        if (aData.lookDir) obj.lookByDir(aData.lookDir);

        // add hp bar
        this._objectHpViewer.addBar(obj, !this.isCurrentOwner(aData.owner));

        AudioMng.getInstance().playSfx({ alias: AudioAlias.battleCreepSpawn, volume: .3 });

        this._dummyMain.add(obj);
        this._objects.set(aData.id, obj);

        return obj;

    }

    private createHomingMissile(aData: ObjectCreateData) {
        let obj = new HomingMissile({
            ...aData,
            ...{
                camera: this._camera,
                effectsParent: this._dummyMain,
                race: this.getRaceForWalletAddr(aData.owner),
                light: {
                    parent: this._dummyMain,
                    ...SETTINGS.towers.light,
                    color: this.isCurrentOwner(aData.owner) ? SETTINGS.towers.light.ownerColor : SETTINGS.towers.light.enemyColor
                },
                showRadius: DEBUG_GUI.showObjectRadius,
                showAttackRadius: DEBUG_GUI.showObjectAttackRadius
            }
        });

        if (!obj) {
            this.logError(`createHomingMissile: obj == NULL`);
            return;
        }

        if (aData.pos) {
            const clientPos = this.getPositionByServer({ x: aData.pos.x, y: aData.pos.z });
            obj.position.copy(clientPos);
        }

        if (aData.q) {
            obj.setQuaternion(aData.q);
            obj.setTargetQuaternion(aData.q);
        }

        if (aData.lookDir) obj.lookByDir(aData.lookDir);

        this._dummyMain.add(obj);
        this._objects.set(aData.id, obj);
    }

    private createLaser(params: {
        length,
        startPos,
        endPos,
        color,
    }) {
        const laserLen = params.length;
        const laserColor = params.color;
        const firePoint = params.startPos;
        const targetPoint = params.endPos;

        let laser = new LaserLine({
            posStart: new THREE.Vector3(0, 0, 0),
            posEnd: new THREE.Vector3(0, 0, laserLen),
            color: laserColor,
            minRadius: .02,
            maxRadius: .2
        });
        laser.position.copy(firePoint);
        laser.lookAt(targetPoint);

        // show laser
        const dur = .25;
        gsap.to(laser.position, {
            x: targetPoint.x,
            y: targetPoint.y,
            z: targetPoint.z,
            duration: dur,
            ease: 'none',
            onStart: () => {
                const sounds = [AudioAlias.battleFireCreep_1, AudioAlias.battleFireCreep_2];
                let sndAlias = sounds[MyMath.randomIntInRange(0, sounds.length - 1)];
                AudioMng.getInstance().playSfx(sndAlias);
            },
            onComplete: () => {
                laser.free();
            }
        });

        this._dummyMain.add(laser);
    }

    private createRay(params: {
        id,
        startPos,
        endPos,
        dy?,
        color,
    }) {
        const startPoint = params.startPos;
        if (params.dy) startPoint.y += params.dy;
        let laser = new LaserLine({
            posStart: startPoint,
            posEnd: params.endPos,
            color: params.color,
            minRadius: 0.1,
            maxRadius: 0.3
        });
        this._dummyMain.add(laser);
        this._attackRays[params.id] = laser;
    }

    private attackPack(aData: AttackData) {

        let objFrom = this.getObjectById(aData.idFrom);
        if (!objFrom) {
            this.logWarn(`attack: !fromObj`, aData);
            return;
        }

        let objTo = this.getObjectById(aData.idTo);
        if (!objTo) {
            this.logWarn(`attack: !toObj`, aData);
            return;
        }

        // DEBUG
        // return;

        let laserColor = this.getShipLaserColor(objFrom.owner);

        switch (aData.attackType) {

            case 'laser':

                // create laser
                const laserLen = 2;
                let r = ThreeUtils.randomVector(objTo.radius / 10);
                const targetPoint = objTo.position.clone().add(r);
                const firePoint = objFrom.getGlobalFirePoint();
                const dir = targetPoint.clone().sub(firePoint).normalize();
                if (aData.isMiss) {
                    targetPoint.add(dir.multiplyScalar(objTo.radius * 4));
                }

                this.createLaser({
                    length: laserLen,
                    color: laserColor,
                    startPos: firePoint,
                    endPos: targetPoint,
                });

                break;
            
            case 'ray':
                // nothing
                break;

            default:
                this.logWarn(`onAttackPack: unknown attack type:`, aData);
                break;
        }

    }

    private rayStart(aData: {
        idFrom: number,
        idTo: number
    }) {
        let objFrom = this.getObjectById(aData.idFrom);
        if (!objFrom) {
            this.logWarn(`rayStart: !fromObj`, aData);
            return;
        }

        let objTo = this.getObjectById(aData.idTo);
        if (!objTo) {
            this.logWarn(`rayStart: !toObj`, aData);
            return;
        }

        let laserColor = this.getShipLaserColor(objFrom.owner);

        // create ray
        this.createRay({
            id: aData.idFrom,
            color: laserColor,
            startPos: objFrom.position,
            endPos: objTo.position,
            dy: -objFrom.radius / 6,
        });

        // startPoint.y -= objFrom.radius / 6;
        // let laser = new LaserLine({
        //     posStart: startPoint,
        //     posEnd: objTo.position.clone(),
        //     color: laserColor,
        //     minRadius: 0.1,
        //     maxRadius: 0.3
        // });
        // this._dummyMain.add(laser);

        // this._attackRays[aData.idFrom] = laser;

    }

    private stopRay(aRayId: number) {
        let laser = this._attackRays[aRayId];
        this._attackRays[aRayId] = null;
        laser?.hide({
            dur: 1,
            cb: () => {
                laser.free();
            },
            ctx: this
        });
    }

    private planetLaser(aData: PlanetLaserData) {
        let planet = this.getObjectById(aData.planetId);
        if (!planet) {
            LogMng.warn(`planetLaser: !planet for...`, aData);
            return;
        }

        let laserColor = this.getPlanetLaserColor(aData.skin);
        let originPos = this.getPositionByServerV3(aData.pos);
        let dir = new THREE.Vector3(aData.dir.x, aData.dir.y, aData.dir.z);
        dir.multiplyScalar(aData.length);
        let targetPos = originPos.clone().add(dir);
        // create laser
        let laser = new LaserLine({
            posStart: originPos,
            posEnd: targetPos,
            color: laserColor,
            minRadius: .02,
            maxRadius: .5
        });
        this._dummyMain.add(laser);

        AudioMng.getInstance().playSfx(AudioAlias.battlePlanetLaserFire);

        laser.hide({
            dur: 1,
            cb: () => {
                laser.free();
            },
            ctx: this
        });
    }

    private onExplosionPack(aData: ExplosionData) {
        let pos = this.getPositionByServerV3(aData.pos);

        if (GlobalParams.BATTLE.explosion2d) {
            let pos2d = ThreeUtils.vectorToScreenPosition(this._render.renderer, pos, this._camera, Math.min(2, DeviceInfo.getInstance().devicePixelRatio));
            GameEventDispatcher.explosion(pos2d);
        }
        else {
            this._explosionSystem.exposion(pos);
        }

        // snd
        const snd = [AudioAlias.battleExplosionSmall_1, AudioAlias.battleExplosionSmall_2, AudioAlias.battleExplosionBig];
        let sndAlias = snd[MyMath.randomIntInRange(0, snd.length - 1)];
        AudioMng.getInstance().playSfx(sndAlias);

    }

    private onRocketPacket(aData: RocketPacket) {
        switch (aData.action) {
            case 'targetCreate':
                let obj = this.getObjectById(aData.targetId);
                this._rocketTargetViewer.createAim(obj, aData);
                break;
        
            default:
                break;
        }
    }

    private onSniperPack(aSniperData: SniperData) {
        let planet = this._objects.get(aSniperData.planetId) as BattlePlanet;
        if (!planet) {
            this.logWarn(`onSniperPack: unknown planet id: ${aSniperData.planetId}`, aSniperData);
            return;
        }
        switch (aSniperData.action) {
            case 'start':
                planet.showSniperAim();
                break;
            case 'end':
                planet.hideSniperAim();
                break;
            default:
                this.logWarn(`onSniperPack: unknown aSniperData.action: ${aSniperData.action}`, aSniperData);
                break;
        }
    }

    private destroyObject(aId: number) {

        // remove rocket targets
        this._rocketTargetViewer.onObjectDestroy(aId);

        // remove object bars
        this._objectHpViewer.removeBar(aId);

        // remove object
        let obj = this.getObjectById(aId);
        if (!obj) {
            this.logError(`updateObject(): !obj`, aId);
            return;
        }
        obj.free();
        this._objects.delete(aId);

        // remove object rays
        let rayEfect = this._attackRays[aId];
        if (rayEfect) {
            rayEfect.hide({
                dur: .1,
                cb: () => {
                    this._attackRays[aId] = null;
                    rayEfect.free();
                },
                ctx: this
            });
        }

    }

    public get walletNumber(): string {
        return this._walletAddr;
    }

    public set walletNumber(value: string) {
        this._walletAddr = value;
    }

    initDebugGui(aFolder: GUI) {
        
        const DEBUG_OBJ = {
            createTestFighters: () => {
                for (let i = 0; i < 1000; i++) {
                    this.createFighter({
                        type: 'FighterShip',
                        attackRadius: 0,
                        hp: 1000,
                        id: 100000 + i,
                        pos: {
                            x: i * 10 % 100,
                            y: 0,
                            z: Math.trunc(i * 10 / 100)
                        },
                        radius: 2,
                        shield: 1000
                    });
                }
            },
            createTestLinkors: () => {
                for (let i = 0; i < 1000; i++) {
                    this.createLinkor({
                        type: 'BattleShip',
                        attackRadius: 0,
                        hp: 1000,
                        id: 100000 + i,
                        pos: {
                            x: i * 10 % 100,
                            y: 0,
                            z: Math.trunc(i * 10 / 100)
                        },
                        radius: 2,
                        shield: 1000
                    });
                }
            },
            destroyTestObjects: () => {
                for (let i = 0; i < 1000; i++) {
                    this.destroyObject(100000 + i);
                }
            },
            testRays: () => {
                for (let i = 0; i < 1000; i++) {
                    const id = 200000 + i;
                    setTimeout(() => {
                        this.createRay({
                            id: id,
                            color: 0xffffff,
                            startPos: new THREE.Vector3(
                                MyMath.randomInRange(0, 100),
                                0,
                                MyMath.randomInRange(0, 100),
                            ),
                            endPos: new THREE.Vector3(
                                MyMath.randomInRange(0, 100),
                                0,
                                MyMath.randomInRange(0, 100),
                            ),
                        });
                        setTimeout(() => {
                            this.stopRay(id);
                        }, 3000);
                    }, 3000 + i * 2);
                }
            },
            testLasers: () => {
                for (let i = 0; i < 1000; i++) {
                    setTimeout(() => {
                        this.createLaser({
                            length: 2,
                            color: 0xffffff,
                            startPos: new THREE.Vector3(
                                MyMath.randomInRange(0, 100),
                                0,
                                MyMath.randomInRange(0, 100),
                            ),
                            endPos: new THREE.Vector3(
                                MyMath.randomInRange(0, 100),
                                0,
                                MyMath.randomInRange(0, 100),
                            ),
                        });
                    }, 3000 + i * 2);
                }
            }
        }

        const f = aFolder;

        f.add(DEBUG_GUI, 'showAxies').onChange((aShow: boolean) => {
            if (aShow) {
                if (this._axiesHelper) return;
                this._axiesHelper = new THREE.AxesHelper(150);
                this._dummyMain.add(this._axiesHelper);
            }
            else {
                if (!this._axiesHelper) return;
                this._dummyMain.remove(this._axiesHelper);
                this._axiesHelper = null;
            }
        }).name(`Axies`);

        f.add(DEBUG_GUI, 'showMyDamage').name(`Damage To Me`);

        f.add(DEBUG_GUI, 'showObjectRadius').onChange((aShow: boolean) => {
            this._objects.forEach(obj => {
                if (aShow) {
                    obj.createDebugRadiusSphere();
                }
                else {
                    obj.destroyDebugRadiusSphere();
                }
            });
        }).name(`Object Radius`);

        f.add(DEBUG_GUI, 'showObjectAttackRadius').onChange((val: boolean) => {
            this._objects.forEach(obj => {
                if (val) {
                    obj.createDebugAttackSphere();
                }
                else {
                    obj.destroyDebugAttackSphere();
                }
            });
        }).name(`Attack Radius`);

        f.add(DEBUG_GUI, 'lightHelpers').name('Light Helpers').onChange((aVal: boolean) => {
            // stars
            let stars: BattleStar[] = this.getObjectsByType('Star') as BattleStar[];
            for (let i = 0; i < stars.length; i++) {
                const star = stars[i];
                star.lightHelperVisible = DEBUG_GUI.lightHelpers;
            }
            // towers
            let towers: Tower[] = this.getObjectsByType('Tower') as Tower[];
            for (let i = 0; i < towers.length; i++) {
                const tower = towers[i];
                tower.lightHelperVisible = aVal;
            }
        });

        f.add(DEBUG_OBJ, 'createTestFighters').name('Test Fighters');
        f.add(DEBUG_OBJ, 'createTestLinkors').name('Test Linkors');
        f.add(DEBUG_OBJ, 'destroyTestObjects').name('Test Objects Destroy');
        f.add(DEBUG_OBJ, 'testRays').name('Test Rays');
        f.add(DEBUG_OBJ, 'testLasers').name('Test Lasers');

        // star lights
        let starsFolder = f.addFolder('Stars');
        starsFolder.add(SETTINGS.stars.light, 'height', 0, 50, .1).name('Height').onChange((aVal: number) => {
            let stars: BattleStar[] = this.getObjectsByType('Star') as BattleStar[];
            for (let i = 0; i < stars.length; i++) {
                const star = stars[i];
                star.lightHeight = aVal;
            }
        })
        starsFolder.add(SETTINGS.stars.light, 'intens', .1, 5, .1).name('Intensity').onChange((aVal: number) => {
            let stars: BattleStar[] = this.getObjectsByType('Star') as BattleStar[];
            for (let i = 0; i < stars.length; i++) {
                const star = stars[i];
                star.lightIntens = aVal;
            }
        })
        starsFolder.add(SETTINGS.stars.light, 'dist', 0, 100, .1).name('Distance').onChange((aVal: number) => {
            let stars: BattleStar[] = this.getObjectsByType('Star') as BattleStar[];
            for (let i = 0; i < stars.length; i++) {
                const star = stars[i];
                star.lightDist = aVal;
            }
        })
        starsFolder.add(SETTINGS.stars.light, 'decay', 0, 3, .01).name('Decay').onChange((aVal: number) => {
            let stars: BattleStar[] = this.getObjectsByType('Star') as BattleStar[];
            for (let i = 0; i < stars.length; i++) {
                const star = stars[i];
                star.lightDecay = aVal;
            }
        })

        // tower lights
        let towerFolder = f.addFolder('Towers');
        towerFolder.add(SETTINGS.towers.light, 'height', 0, 50, .1).name('Height').onChange((aVal: number) => {
            let towers: Tower[] = this.getObjectsByType('Tower') as Tower[];
            for (let i = 0; i < towers.length; i++) {
                const tower = towers[i];
                tower.lightHeight = aVal;
            }
        })
        towerFolder.add(SETTINGS.towers.light, 'intens', .1, 5, .1).name('Intensity').onChange((aVal: number) => {
            let towers: Tower[] = this.getObjectsByType('Tower') as Tower[];
            for (let i = 0; i < towers.length; i++) {
                const star = towers[i];
                star.lightIntens = aVal;
            }
        })
        towerFolder.add(SETTINGS.towers.light, 'dist', 0, 50, .1).name('Distance').onChange((aVal: number) => {
            let towers: Tower[] = this.getObjectsByType('Tower') as Tower[];
            for (let i = 0; i < towers.length; i++) {
                const star = towers[i];
                star.lightDist = aVal;
            }
        })
        towerFolder.add(SETTINGS.towers.light, 'decay', 0, 3, .01).name('Decay').onChange((aVal: number) => {
            let towers: Tower[] = this.getObjectsByType('Tower') as Tower[];
            for (let i = 0; i < towers.length; i++) {
                const star = towers[i];
                star.lightDecay = aVal;
            }
        })

    }

    getPlayerSun(aOwner: string): BattleStar {
        let sun: BattleStar;
        this._objects.forEach(obj => {
            if (sun) return;
            if (obj instanceof BattleStar) {
                if (obj.owner == aOwner) {
                    sun = obj;
                }
            }
        });
        return sun;
    }

    getCurrentPlayerSun(): BattleStar {
        return this.getPlayerSun(this._walletAddr);
    }

    destroyAllObjects() {

        this._objects.forEach(obj => {
            obj.free();
        });
        this._objects.clear();

        for (const key in this._attackRays) {
            const rayEfect = this._attackRays[key];
            if (rayEfect) rayEfect.free();
        }
        this._attackRays = {};

    }

    show() {
        this._dummyMain.visible = true;
    }

    hide() {
        this._dummyMain.visible = false;
    }

    clear() {

        this.removeInput();
        this.removeConnectionListeners();

        this._damageViewer.free();
        this._damageViewer = null;

        this._textViewer.free();
        this._textViewer = null;

        this._objectHpViewer.free();
        this._objectHpViewer = null;

        this._rocketTargetViewer.free();
        this._rocketTargetViewer = null;

        // clear all objects
        this.destroyAllObjects();

        this._render = null;
        this._scene = null;
        this._camera = null;
        this._raycaster = null;
        this._connection = null;
        this._cameraTarget = null;
        this._cameraMng.free();
        this._cameraMng = null;

        this._playerRace = null;
        this._enemyRace = null;

        this.clearFieldCells();

        this._dummyMain.clear();
        this._dummyMain = null;
        this._objects = null;

        this._attackRays = null;
        this._explosionSystem = null;

        this._axiesHelper = null;

    }

    private updateObjects(dt: number) {
        this._objects.forEach((obj) => {
            obj.update(dt);
        });
    }

    update(dt: number) {

        this._cameraMng.update(dt);
        this.updateObjects(dt);
        this._objectHpViewer.update(dt);
        this._explosionSystem?.update(dt);
        this._rocketTargetViewer?.update(dt);

    }

}
