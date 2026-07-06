import { Router } from "express";
import { agentToolsRouter } from "./agent-tools.routes";
import { clinicalAgentRouter } from "./clinical-agent.routes";
import { healthRouter } from "./health.routes";
import { lisRouter } from "./lis.routes";
import { noteRouter } from "./note.routes";
import { soapRouter } from "./soap.routes";
import { transcriptionRouter } from "./transcription.routes";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(lisRouter);
apiRouter.use(agentToolsRouter);
apiRouter.use(clinicalAgentRouter);
apiRouter.use(transcriptionRouter);
apiRouter.use(soapRouter);
apiRouter.use(noteRouter);
