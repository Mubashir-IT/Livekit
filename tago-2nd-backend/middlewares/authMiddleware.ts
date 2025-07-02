import { NextFunction, Request, Response } from 'express';
import jwt from "jsonwebtoken";

const authMiddleware = (req: Request, res: Response, next: NextFunction):void => {
    const authHeader: string = req.headers.authorization || '';

    // Check if token is provided
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
         res.status(401).json({ message: 'Unauthencticated user' });
        return ;
        }

    const token:string = authHeader.split(' ')[1]; // Extract token from "Bearer <token>"
    const secret:string = process.env.JWT_SECRET || "secret"; // Provide a fallback secret


    try {
        // Verify token
        const decoded:any = jwt.verify(token, secret); // Use your JWT secret key
        req.user = decoded; // Store user data in req.user for further use in controllers
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        res.status(403).json({ message: 'Invalid or expired token' ,error});
        return;
    }
};

export default  authMiddleware;