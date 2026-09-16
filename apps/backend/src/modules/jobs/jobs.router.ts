import { Router } from 'express';
import * as ctrl from './jobs.controller';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { scrapeLimiter } from '../../middleware/rateLimiter';
import { CreateJobSchema, UpdateJobSchema, ScrapeSchema } from './jobs.schemas';

const router = Router();

// PUBLIC — must be registered before requireAuth below. Feeds the teaser on
// the marketing landing page. Deliberately minimal: title, company, location
// and type only. No referrer identity, no job id, no description — signed-out
// visitors get a sense of what's live, not a browsable board.
router.get('/sample', ctrl.getPublicSample);

router.use(requireAuth);

// Note: specific paths before /:id to avoid route conflicts
router.post('/scrape', scrapeLimiter, validate(ScrapeSchema), ctrl.scrapeJob);
router.get('/feed', ctrl.getFeed);
router.get('/suggested', ctrl.getSuggestedJobs);
router.get('/mine', ctrl.getMyJobs);

router.get('/', ctrl.searchJobs);
router.post('/', validate(CreateJobSchema), ctrl.createJob);

router.get('/:id', ctrl.getJob);
router.patch('/:id', validate(UpdateJobSchema), ctrl.updateJob);
router.delete('/:id', ctrl.deleteJob);

export default router;
