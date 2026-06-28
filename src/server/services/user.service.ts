import bcrypt from "bcryptjs";
import * as userRepo from "@/server/repositories/user.repo";
import { UserEntity } from "../entities/user.entity";
import { BCRYPT_ROUNDS } from "../utils/constants";
import { NotFoundError, ForbiddenError } from "../utils/errors";
import { logger } from "../utils/logger";

//purpose
/**
 * user self-service operaitons only
 * a user can only act on their own account - enforced by comparing userId
 * Admin operations live in admin.service.ts
 */
//Get profile

export async function getProfile(
    userId:string): Promise<ReturnType<UserEntity["toPublic"]>> {
        const user = await userRepo.findById(userId);
        if (!user) throw new NotFoundError("User");
        return user.toPublic();
}

//update profile
export async function updateProfiel(
    userId:string,
    data: { name?: string}    
): Promise<ReturnType<UserEntity["toPublic"]>> {
    const user = await userRepo.findById(userId);
    if (!user) throw new NotFoundError("User");

    const updated= await userRepo.updateProfile(userId, data);
    if (!updated) throw new NotFoundError("User");

    logger.info("Profile updated", { userId});
    return updated.toPublic();
    
}

//Delete own account
//requires password confirmation - prevents accidental deletion
export async function deleteAcoutn(
    userId:string,
    passwordConfirmaiton: string
    ): Promise<void> {
        const user = await userRepo.findById(userId, { withPassword: true});
        if (!user) throw new NotFoundError("User");

        const match = await bcrypt.compare(passwordConfirmaiton, user.paaawordHash);
        if (!match) throw new ForbiddenError("Password confirmaiton failed");

        await userRepo.deleteById(userId);

        logger.info("Account deleted by user", { userId});
    
}