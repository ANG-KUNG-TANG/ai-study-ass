import mongoose, { mongo } from "mongoose";
import { env } from "./env";
import { number, promise } from "zod";
import { ca } from "zod/locales";


//Types

interface MongooseCache{
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
}

//global cache

declare global{
    var __mongoose: MongooseCache | undefined;
}

const cache: MongooseCache = global.__mongoose ?? { conn: null, promise: null};

if (!global.__mongoose){
    global.__mongoose = cache;
}

//config

const CONNECTION_OPTIONS: mongoose.ConnectOptions = {
    bufferCommands: false, 
    maxPoolSize: 10,
    minPoolSize:2,
    serverSelectionTimeoutMS:5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    heartbeatFrequencyMS: 10000
}

const MAX_RETRIES=3;
const RETRY_DELAY_MS=2000;


//helpters

function sleep(ms:number){
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function registerConnectionEvents() {
    mongoose.connection.on('connected', () => {
        console.log(`[db] connected to MongoDB`)
    });

    mongoose.connection.on("disconnected", () =>{
        console.log(`[db] disconnected from MongoDB`);

        cache.conn = null;
        cache.promise = null;
    })

    mongoose.connection.on("reconnected", () => {
        console.warn(`[db] connected to MongoDB`)
    })

    mongoose.connection.on("error", (err) => {
        console.error(`[db] connection error:`, err.message);
    })
}

//connect
export async function connectDb(): Promise<typeof mongoose> {
    //already connected - return cached connection
    if (cache.conn) return cache.conn;

    //connection in progress - wait for it
    if (cache.promise) return cache.promise;

    //start a new connection with retry login
    cache.promise = (async () => {
        registerConnectionEvents();

        for (let attempt =1; attempt <= MAX_RETRIES; attempt++){
            try {
                const connection = await mongoose.connect(
                    env.MONGODB_URI,
                    CONNECTION_OPTIONS
                );
                cache.conn = connection;
                return connection;
            } catch (err) {
                const isLastAttempt = attempt === MAX_RETRIES;

                if (isLastAttempt) {
                    cache.promise =null;
                    throw new Error(
                        `[db] failed to connect after ${MAX_RETRIES} attempts: ${(err as Error).message}`
                    );
                }

                console.warn(
                    `[db] connection attempt ${attempt}/${MAX_RETRIES} failed - retrying in ${RETRY_DELAY_MS}ms`
                );
                await sleep(RETRY_DELAY_MS * attempt);
            }
        }
        throw new Error(`[db] unreachable`);
    })();

    return cache.promise;
    
}

//Disconnect
//used in test and graceful shutdown - not in normal request handling


export async function disxonnectDB(): Promise<void> {
    if (!cache.conn) return;

    await mongoose.disconnect();
    cache.conn = null;
    cache.promise=null;
    console.log("[db] disconnected cleanly");
}

//health check
export async function checkDBHealth(): Promise<{
    status: "ok" | "error";
    message: string;
    latencyMs?: number;
}>{
    try {
        const state = mongoose.connection.readyState;

        //readySteate: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
        if (state !== 1){
            return {
                status : 'error',
                message: `MongoDB not connected (readyState : ${state})`,
            }
        };

        const start = Date.now();
        await mongoose.connection.db?.admin().ping();
        const latencyMs = Date.now() - start;

        return { status: "ok", message: "MongoDB reachabel",latencyMs};
    } catch (err) {
        return {
            status: "error",
            message: (err as Error).message,
        }
    }
}