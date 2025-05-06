import express from 'express'

const userRouter = express.Router()

userRouter.get('/data', getUserData)


export default userRouter;