import * as THREE from "three";
import { PHANTOM_BIG_STAR_COLOR, PHANTOM_STAR_COLOR, STAR_COLOR_2 } from "../data/DB";
import { GlobalParams } from "../data/GlobalParams";
import { GalaxyCircleParams, GalaxyParams, GalaxySmallParams, GalaxyStarParams, ServerStarData } from "../data/Types";
import { ILogger } from "../core/interfaces/ILogger";
import { LogMng } from "../../monax/LogMng";
import { MyMath } from "../../monax/MyMath";
import { EaseUtils } from "../utils/EaseUtils";

export class StarGenerator implements ILogger {
    private static instance: StarGenerator = null;
    private _starIdCounter: number;

    private constructor() {
        if (StarGenerator.instance) throw new Error("Don't use StarGenerator.constructor(), it's SINGLETON, use getInstance() method");
        this.resetStarId();
    }

    logDebug(aMsg: string, aData?: any): void {
        LogMng.debug(`StarGenerator: ${aMsg}`, aData);
    }
    logWarn(aMsg: string, aData?: any): void {
        LogMng.warn(`StarGenerator: ${aMsg}`, aData);
    }
    logError(aMsg: string, aData?: any): void {
        LogMng.error(`StarGenerator: ${aMsg}`, aData);
    }

    static getInstance(): StarGenerator {
        if (!StarGenerator.instance) StarGenerator.instance = new StarGenerator();
        return StarGenerator.instance;
    }
    
    resetStarId() {
        this._starIdCounter = 0;
    }

    getStarId(): number {
        return 1000000 + this._starIdCounter++;
    }

    generateGalaxyStarsData(aParams: GalaxyParams,
        xScale: number, zScale: number, isPhantom = false, aColorSet?: any[], aBlinkData?: any): GalaxyStarParams[] {

        if (!aParams.startAngle) aParams.startAngle = 0;
        if (!aParams.endAngle) aParams.endAngle = Math.PI;
        if (!aParams.startOffsetXY) aParams.startOffsetXY = 0;
        if (!aParams.endOffsetXY) aParams.endOffsetXY = 0;
        if (!aParams.startOffsetH) aParams.startOffsetH = 0;
        if (!aParams.endOffsetH) aParams.endOffsetH = 0;
        if (!aParams.k) aParams.k = 0.3;
        if (!aParams.alphaMin) aParams.alphaMin = 1;
        if (!aParams.alphaMax) aParams.alphaMax = 1;
        if (!aParams.scaleMin) aParams.scaleMin = 1;
        if (!aParams.scaleMax) aParams.scaleMax = 1;

        let resData: GalaxyStarParams[] = [];
        const numArms = 5;
        const armDeltaAngle = 2 * Math.PI / numArms;

        // check
        if (aParams.startAngle > aParams.endAngle) aParams.startAngle = aParams.endAngle;

        for (let i = 0; i < aParams.starsCount; i++) {
            // choose an angle
            // let angle = Math.pow(Math.random(), 2) * maxAngle;
            // let angle = Math.pow(MyMath.randomInRange(minAngleFactor, 1), 2) * maxAngle;
            let dtAngle = aParams.endAngle - aParams.startAngle;
            let anglePercent = Math.pow(Math.random(), 3);
            let angle = aParams.startAngle + anglePercent * dtAngle;
            let r = aParams.k * angle;

            // set random galaxy arm
            let armId = MyMath.randomIntInRange(0, numArms - 1);
            let armAngle = angle + armId * armDeltaAngle;
            if (armId == 1) armAngle += .2;

            // convert polar coordinates to 2D
            let px = r * Math.cos(armAngle);
            let py = r * Math.sin(armAngle);

            // offset xy

            let offsetVec = new THREE.Vector3().randomDirection();
            let offsetXY = aParams.startOffsetXY + anglePercent * (aParams.endOffsetXY - aParams.startOffsetXY);
            offsetXY *= 0.05;

            let rx = MyMath.randomInRange(-1, 1);
            // let offsetX = offsetXY * rx * Math.abs(rx);
            let offsetX = offsetXY * rx;
            let rz = MyMath.randomInRange(-1, 1);
            // let offsetZ = offsetXY * rz * Math.abs(rz);
            let offsetZ = offsetXY * rz;

            offsetVec.x *= offsetX;
            offsetVec.z *= offsetZ;

            px += offsetVec.x;
            py += offsetVec.z;

            // offset h
            offsetVec.y = Math.pow(offsetVec.y, 3);
            let offsetH = aParams.startOffsetH + anglePercent * (aParams.endOffsetH - aParams.startOffsetH);
            offsetH = offsetH * offsetVec.y;
            // let offsetHFactor = MyMath.easeInExpo((offsetH - offHParams.min) / (offHParams.max - offHParams.min));
            // offsetH = offsetH * MyMath.randomInRange(-1, 1) * offsetHFactor;

            // make result
            let starId = this.getStarId();

            let starLevel = 1;
            let lvlRandom = MyMath.randomInRange(0, 100);
            if (lvlRandom <= 3000 / 210) starLevel = 2;
            if (lvlRandom <= 1200 / 210) starLevel = 3;
            if (lvlRandom <= 210 / 210) starLevel = 4;
            if (lvlRandom <= 21 / 210) starLevel = 5;
            if (GlobalParams.isDebugMode || GlobalParams.isFakeStarLevels) {
                if (lvlRandom <= 60) starLevel = 2;
                if (lvlRandom <= 40) starLevel = 3;
                if (lvlRandom <= 20) {
                    starLevel = 4;
                }
                if (lvlRandom <= 10) {
                    starLevel = 5;
                    // debugger;
                }
            }

            // color
            let clr = new THREE.Color(1, 1, 1);
            let clrBigStar: any;

            if (isPhantom) {
                clr.r = PHANTOM_STAR_COLOR.r;
                clr.g = PHANTOM_STAR_COLOR.g;
                clr.b = PHANTOM_STAR_COLOR.b;
                clrBigStar = PHANTOM_BIG_STAR_COLOR;
            }
            else if (aColorSet) {
                let customStarColor = aColorSet[MyMath.randomIntInRange(0, aColorSet.length - 1)];
                clr.r = customStarColor[0];
                clr.g = customStarColor[1];
                clr.b = customStarColor[2];
            }
            else {
                let colorSet = STAR_COLOR_2[starLevel];
                let clrLen = colorSet.galaxyStar.length;
                let clrId = clrLen > 1 ? MyMath.randomIntInRange(0, clrLen - 1) : 0;
                clr.r = colorSet.galaxyStar[clrId].r;
                clr.g = colorSet.galaxyStar[clrId].g;
                clr.b = colorSet.galaxyStar[clrId].b;
                clrBigStar = colorSet.bigStar[clrId];
            }

            let planetCnt = MyMath.randomIntInRange(1, 5);
            switch (starLevel) {
                case 2: planetCnt = MyMath.randomIntInRange(5, 10); break;
                case 3: planetCnt = MyMath.randomIntInRange(10, 25); break;
                case 4: planetCnt = MyMath.randomIntInRange(25, 50); break;
                case 5: planetCnt = MyMath.randomIntInRange(50, 100); break;
            }

            let energy = MyMath.randomIntInRange(1, 10);
            switch (starLevel) {
                case 2: energy = MyMath.randomIntInRange(10, 25); break;
                case 3: energy = MyMath.randomIntInRange(25, 50); break;
                case 4: energy = MyMath.randomIntInRange(50, 100); break;
                case 5: energy = MyMath.randomIntInRange(100, 1000); break;
            }

            let life = MyMath.randomIntInRange(0, 100);
            let position = {
                x: Math.trunc(px * xScale * 1000000) / 1000000,
                y: Math.trunc(offsetH * 1000000) / 1000000,
                z: Math.trunc(py * zScale * 1000000) / 1000000
            };

            resData[i] = {
                id: starId,
                pos: position,
                color: {
                    r: clr.r,
                    g: clr.g,
                    b: clr.b,
                    a: MyMath.randomInRange(aParams.alphaMin, aParams.alphaMax)
                },
                scale: MyMath.randomInRange(aParams.scaleMin, aParams.scaleMax),

                starInfo: {
                    name: `Star ${starId}`,
                    description: `Star ${starId} description`,
                    level: starLevel,
                    // raceId: race,
                    planetSlots: planetCnt,
                    energy: energy,
                    life: life,
                    bigStar: {
                        starSize: 30,
                        color: clrBigStar
                    }
                }

            };

            if (aBlinkData) {
                let dur = MyMath.randomInRange(aBlinkData.durationMin, aBlinkData.durationMax);
                resData[i].blink = {
                    isFade: Math.random() > 0.5,
                    duration: dur,
                    progressTime: MyMath.randomInRange(0, dur),
                    tweenFunction: EaseUtils.easeInOutSine
                }
            }
        }

        return resData;
    }

    generateSolarSystemStarsData(aParams: GalaxyCircleParams, aColorSet: any[], aBlinkData?: any): GalaxyStarParams[] {

        if (!aParams.minRadius) aParams.minRadius = 0;
        if (!aParams.alphaMin) aParams.alphaMin = 1;
        if (!aParams.alphaMax) aParams.alphaMax = 1;
        if (!aParams.scaleMin) aParams.scaleMin = 1;
        if (!aParams.scaleMax) aParams.scaleMax = 1;
        let resData: GalaxyStarParams[] = [];
        const numArms = 5;
        const armDeltaAngle = 2 * Math.PI / numArms;

        // check
        if (aParams.minRadius > aParams.maxRadius) aParams.minRadius = aParams.maxRadius;

        for (let i = 0; i < aParams.starsCount; i++) {
            let pos = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
            pos.normalize().multiplyScalar(MyMath.randomInRange(aParams.minRadius, aParams.maxRadius));

            let clr = new THREE.Color(1, 1, 1);

            let customStarColor = aColorSet[MyMath.randomIntInRange(0, aColorSet.length - 1)];
            clr.r = customStarColor[0];
            clr.g = customStarColor[1];
            clr.b = customStarColor[2];

            // make result
            resData[i] = {
                id: 0,
                pos: {
                    x: pos.x,
                    y: pos.y,
                    z: pos.z
                },
                color: {
                    r: clr.r,
                    g: clr.g,
                    b: clr.b,
                    a: MyMath.randomInRange(aParams.alphaMin, aParams.alphaMax)
                },
                scale: MyMath.randomInRange(aParams.scaleMin, aParams.scaleMax)
            };

            if (aBlinkData) {
                let dur = MyMath.randomInRange(aBlinkData.durationMin, aBlinkData.durationMax);
                resData[i].blink = {
                    isFade: Math.random() > 0.5,
                    duration: dur,
                    progressTime: MyMath.randomInRange(0, dur),
                    tweenFunction: EaseUtils.easeInOutSine
                }
            }

        }

        return resData;
    }

    getRealStarDataByServer(aParams: GalaxySmallParams, aServerStars: ServerStarData[]): GalaxyStarParams[] {
        let resData: GalaxyStarParams[] = [];
        for (let i = 0; i < aServerStars.length; i++) {
            const serverStar = aServerStars[i];
            const serverStarParams = serverStar.params;
            const pos = serverStarParams.coords;

            if (pos.X == null || pos.Y == null || pos.Z == null) {
                this.logWarn(`getRealStarDataByServer(): !pos.X || !pos.Y || !pos.Z for serverStarData:`, serverStar);
                continue;
            }
            
            // color
            let clr = new THREE.Color(1, 1, 1);
            let clrBigStar: any;
            let colorSet = STAR_COLOR_2[serverStarParams.level];
            let clrLen = colorSet.galaxyStar.length;
            let clrId = clrLen > 1 ? MyMath.randomIntInRange(0, clrLen - 1) : 0;
            clr.r = colorSet.galaxyStar[clrId].r;
            clr.g = colorSet.galaxyStar[clrId].g;
            clr.b = colorSet.galaxyStar[clrId].b;
            clrBigStar = colorSet.bigStar[clrId];

            // race
            let raceName: string = serverStar.params.race;
            

            resData.push({
                id: serverStar.id,
                pos: { x: pos.X, y: pos.Y, z: pos.Z },
                scale: MyMath.randomInRange(aParams.scaleMin, aParams.scaleMax),
                color: {
                    r: clr.r,
                    g: clr.g,
                    b: clr.b,
                    a: MyMath.randomInRange(aParams.alphaMin, aParams.alphaMax)
                },
                starInfo: {
                    serverData: serverStar,
                    name: serverStarParams.name,
                    description: `Star description`,
                    level: serverStarParams.level,
                    // TODO: get real race
                    // raceId: 0,
                    planetSlots: serverStarParams.planetSlots,
                    energy: serverStarParams.fuel,
                    life: serverStarParams.fuel, // ???
                    bigStar: {
                        starSize: 30,
                        color: clrBigStar
                    }
                }
            });
        }
        return resData;
    }

    starToPhantom(aData: GalaxyStarParams) {
        // color
        let clr = new THREE.Color(1, 1, 1);
        let clrBigStar: any;
        clr.r = PHANTOM_STAR_COLOR.r;
        clr.g = PHANTOM_STAR_COLOR.g;
        clr.b = PHANTOM_STAR_COLOR.b;
        clrBigStar = PHANTOM_BIG_STAR_COLOR;

        aData.color.r = clr.r;
        aData.color.g = clr.g;
        aData.color.b = clr.b;
        aData.starInfo.bigStar.color = clrBigStar;
    }

}