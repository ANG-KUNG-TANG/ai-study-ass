import mongoose, {Schema, Document, Model} from "mongoose";

//types

export interface IRevokedToken extends Document{
    jti: string;
    userId: string;
    expiredAt: Date;
}

//Schema
const revokedTokenSchema = new Schema<IRevokedToken>({
    jti: {
        type: String,
        required:true,
        unique:true,
        index: true
    },
    userId: {
        type:String,
        required: true,
        index: true
    },
    expiredAt: {
        type: Date,
        required: true,
    }
});

/**
 * TTL index - MongoDB automatically deletes documents after expiresAt,
 * this keeps the blocklist from growing froever
 * expired tokens can't be used anywasy (jwt.verify rejects them).
 * so there's no security rist in removing them form the blocklist
 */
revokedTokenSchema.index({expiresAt: 1}, {expireAfterSeconds: 0});


//Model
export const RevokedToken: Model<IRevokedToken> =
    mongoose.models.RevokedToken ??
    mongoose.model<IRevokedToken>("RevokedToken", revokedTokenSchema);