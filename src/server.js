const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const { env, logger, morgan, i18nService } = require('./config');
const { errorConverter, errorHandler } = require('./middlewares/error.middleware');

const apiRoute = require('./routes/api');
const baseRouter = require('./routes/base.route');
const limiter = require('./middlewares/rate-limit.middleware');

const app = express();

app.set('trust proxy', 1);
app.set('views', 'src/views');
app.set('view engine', 'ejs');

app.use(limiter());
app.use(helmet());

app.use(express.json());
app.use(cookieParser());
app.use(cors());
app.options('*', cors());

app.use((req, res, next) => {
  next(i18nService.setLocale(req, res));
});

if (env.NODE_ENV !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}
app.use('/api/v1', apiRoute);
app.use('/', baseRouter);

app.use(errorConverter);
app.use(errorHandler);

mongoose
  .connect(env.mongoURI)
  .then(() => logger.info('MongoDB Connected...'))
  .then(() =>
    app.listen(env.port, () => {
      logger.info(`Server running on port ${env.port}`);
    }),
  )
  .catch((err) => logger.error(err));
