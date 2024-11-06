import { MyMath } from '@/utils';
import gsap from 'gsap';
import * as THREE from 'three';
import { MyObject3D } from "~/game/basics/MyObject3D";
import { ObjectCreateData, ObjectType } from '~/game/battle/Types';
import { TextureAlias } from '~/game/data/TextureData';
import { ThreeLoader } from '~/game/utils/threejs/ThreeLoader';
import { ThreeUtils } from '~/game/utils/threejs/ThreejsUtils';

export type BattleObjectData = ObjectCreateData & {
    showRadius?: boolean,
    showAttackRadius?: boolean,
    highlighting?: {
        active: boolean,
        isEnemy: boolean
    }
}

export class BattleObject extends MyObject3D {
    protected _params: BattleObjectData;
    protected _hpMax: number;
    protected _hp: number;
    private _shieldMax: number;
    private _shield: number;
    private _debugRadiusSphere: THREE.Mesh;
    private _debugAttackRadius: THREE.Mesh;
    private _targetPosition: { x: number; z: number; };
    private _dirrection: THREE.Vector3;
    private _targetQuaternion: THREE.Quaternion;
    private _meshColorLayer: THREE.Mesh;

    constructor(aParams: BattleObjectData, aClassName?: string) {
        super(aClassName || 'BattleObject');
        this._params = aParams;
        this._hp = this._hpMax = this._params.hp;
        this._shield = this._shieldMax = this._params.shield;
        this._dirrection = new THREE.Vector3(0, 0, 1);
        this._targetQuaternion = this.quaternion.clone();

        if (aParams.showRadius) {
            this.createDebugRadiusSphere();
        }
        if (aParams.showAttackRadius) {
            this.createDebugAttackSphere();
        }

        if (this._params.highlighting) {
            this.initHighlightning();
        }

    }

    protected initHighlightning() {
        const t = ThreeLoader.getInstance().getTexture(TextureAlias.particleWhiteCircle);
        const clr = this._params.highlighting.isEnemy ? 0xff0000 : 0x0000ff;
        let g = new THREE.PlaneGeometry(this.radius * 2.5, this.radius * 2.5);
        let m = new THREE.MeshBasicMaterial({
            map: t,
            color: clr,
            transparent: true,
            opacity: .4
        });
        this._meshColorLayer = new THREE.Mesh(g, m);
        this._meshColorLayer.rotation.x = -Math.PI / 2;
        this._meshColorLayer.position.y = -this.radius / 2;
        this.add(this._meshColorLayer);
    }

    public get objId(): number {
        return this._params.id;
    }

    public get objType(): ObjectType {
        return this._params.type;
    }

    public get radius(): number {
        return this._params.radius;
    }

    public set radius(value: number) {
        this._params.radius = value;
    }

    public get hpMax(): number {
        return this._hpMax;
    }

    public get hp(): number {
        return this._hp;
    }
    
    public set hp(value: number) {
        let newHp = Math.max(0, value);
        this._hp = newHp;
    }

    get shieldMax(): number {
        return this._shieldMax;
    }

    get shield(): number {
        return this._shield;
    }

    set shield(value: number) {
        let newVal = Math.max(0, value);
        this._shield = newVal;
    }

    public get owner(): string {
        return this._params.owner;
    }

    public get targetPosition(): { x: number; z: number; } {
        return this._targetPosition;
    }
    public set targetPosition(value: { x: number; z: number; }) {
        this._targetPosition = value;
    }

    createDebugRadiusSphere() {
        if (this._debugRadiusSphere) return;
        const geometry = new THREE.TorusGeometry(this._params.radius, .2, 2, 20);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: .3,
            depthWrite: false
        });
        this._debugRadiusSphere = new THREE.Mesh(geometry, material);
        this._debugRadiusSphere.rotation.x = MyMath.toRadian(-90);
        this.add(this._debugRadiusSphere);
    }

    destroyDebugRadiusSphere() {
        if (!this._debugRadiusSphere) return;
        this.remove(this._debugRadiusSphere);
        this._debugRadiusSphere = null;
    }

    createDebugAttackSphere() {
        if (this._debugAttackRadius) return;
        const geometry = new THREE.TorusGeometry(this._params.attackRadius, .15, 2, 20);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: .2,
            depthWrite: false
        });
        this._debugAttackRadius = new THREE.Mesh(geometry, material);
        this._debugAttackRadius.rotation.x = MyMath.toRadian(-90);
        this.add(this._debugAttackRadius);
    }

    destroyDebugAttackSphere() {
        if (!this._debugAttackRadius) return;
        this.remove(this._debugAttackRadius);
        this._debugAttackRadius = null;
    }

    getGlobalFirePoint(): THREE.Vector3 {
        return this.position.clone();
    }

    rotateToPoint(aPoint: THREE.Vector3, aDuration: number) {
        let startQ = this.quaternion.clone();
        this.lookAt(aPoint);
        let targetQ = this.quaternion.clone();
        this.quaternion.copy(startQ);
        const tweenObj = { t: 0 };
        gsap.to(tweenObj, {
            t: 1,
            duration: aDuration / 1000,
            ease: 'sine.inOut',
            onUpdate: () => {
                let q = startQ.clone().slerp(targetQ, tweenObj.t);
                this.quaternion.copy(q);
            }
        });
    }

    jumpToPoint(aPoint: THREE.Vector3, aDuration: number) {
        let startPos = this.position.clone();
        let targetPos = aPoint;

        gsap.to(this.scale, {
            x: .8,
            y: .8,
            duration: aDuration / 1000 / 2,
            ease: 'power4.in',
            yoyo: true,
            repeat: 1
        });

        const tweenObj = { t: 0 };
        gsap.to(tweenObj, {
            t: 1,
            duration: aDuration / 1000,
            ease: 'power4.inOut',
            onUpdate: () => {
                // let p = targetPos.clone().sub(startPos).normalize().multiplyScalar(tweenObj.t);
                let p = startPos.clone().lerp(targetPos, tweenObj.t);
                this.position.copy(p);
            }
        });
    }

    free() {
        this._params = null;

        this._targetPosition = null;
        this._dirrection = null;
        this._targetQuaternion = null;

        if (this._debugRadiusSphere) ThreeUtils.removeAndDispose(this._debugRadiusSphere);
        this._debugRadiusSphere = null;

        if (this._debugAttackRadius) ThreeUtils.removeAndDispose(this._debugAttackRadius);
        this._debugAttackRadius = null;

        if (this._meshColorLayer) ThreeUtils.removeAndDispose(this._meshColorLayer);
        this._meshColorLayer = null;

        super.free();
    }

    setQuaternion(q: { x, y, z, w }) {
        this.quaternion.set(q.x, q.y, q.z, q.w);
    }

    setTargetQuaternion(q: { x, y, z, w }) {
        this._targetQuaternion.set(q.x, q.y, q.z, q.w);
    }

    lookByDir(aDir: { x, y, z }) {
        let dir = new THREE.Vector3(aDir.x, aDir.y, aDir.z);
        let p = this.position.clone().add(dir);
        this.lookAt(p);
    }

    updateQuaternion(dt: number) {
        this.quaternion.slerp(this._targetQuaternion, .1);
    }

    update(dt: number) {

        // move
        if (this._targetPosition) {
            const moveFactor = dt * 4;
            this.position.x += (this._targetPosition.x - this.position.x) * moveFactor;
            this.position.z += (this._targetPosition.z - this.position.z) * moveFactor;
        }

        // rotate
        this.updateQuaternion(dt);

    }

}