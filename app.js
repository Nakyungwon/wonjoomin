var express     = require('express');
var path        = require('path');
var favicon     = require('serve-favicon');
var logger      = require('morgan');
var session     = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser  = require('body-parser');
var flash       = require('connect-flash');
var robots      = require('robots.txt')
var useragent   = require("express-useragent")

var passport    = require('./routes/passport'); 
var index       = require('./routes/index');
var users       = require('./routes/users');
var board       = require('./routes/board');
var pboard      = require('./routes/p_board');
var message     = require('./routes/message');
var admin       = require('./routes/admin');
var db          = require('./routes/db');
var autoLogin   = require('./routes/autoLogin');
var visitCount  = require('./routes/visitCount');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({limit: '10mb', extended: false, parameterLimit: 10000}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(robots(__dirname + '/robots.txt'))

app.use(useragent.express());

app.use(flash());
app.use(session({ secret: 'secret-onejumin', resave: true, saveUninitialized: false })); // 세션 활성화
app.use(passport.initialize()); // passport 구동
app.use(passport.session()); // 세션 연결
app.disable("x-powered-by");

app.use('/', index);
app.use('/board', board);
app.use('/users', users);
app.use('/admin', admin);
app.use('/p_board', pboard);
app.use('/message', message);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.listen(5000,function(){
  console.log('원주민 Server Started.....');
});


module.exports = app;
