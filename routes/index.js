var express   = require('express');
var db        = require('./db');
var autoLogin = require('./autoLogin');
var passport  = require('./passport');
var moment    = require('moment'); //시간 
var visitCount = require('./visitCount');
var side      = require('./side');
var router    = express.Router();

/**
 * header 메뉴 마스터 세팅
 */
router.post('/', async function(req, res, next) {
  const menuList = await db.query(
    `select MENU_ID      AS MENU_ID
            ,MENU_NAME   AS MENU_NAME
      FROM MENU_MASTER
     WHERE USE_YN = 'Y'
     ORDER BY ORDER_PORITY ASC
    `
  )
  res.send({menuList: menuList.rows, user_info : req.user});
});

/**
 * header 세부메뉴 클릭시 세팅
 */
router.post('/smMenu', async function(req, res, next) {
  const { k_menuId } = req.body
  const smMenuList = await db.query(
    `select SM_MENU_ID      AS SM_MENU_ID
            ,SM_MENU_NAME   AS SM_MENU_NAME
            ,MENU_GBN       AS MENU_GBN
      FROM SM_MENU
     WHERE USE_YN = 'Y'
       AND MENU_ID = $1
     ORDER BY ORDER_PORITY ASC
    `
    ,[k_menuId]
  )
  res.send({smMenuList: smMenuList.rows});
});

/** 자동로그인 */
router.all('/', function(req,res,next){
    visitCount.visitLog(req,res,next);
    autoLogin.autoLogin(req,res,next);
  }
)

/* GET home page. */
router.get('/', async function(req, res, next) {
  var imglist = new Array();
  var normallist = new Array();
  var starlist = new Array();

  // 일반게시판 쪽 QUERY
   const normalListCnt = await db.query(
    `
      SELECT SM_MENU_ID
        FROM SM_MENU 
       WHERE MENU_GBN = 'N'
         AND INDEX_YN = 'Y'
         AND STAR_YN  = 'N'
    `
  )

  for(var i = 0 ; i < normalListCnt.rows.length ; i++){
    normallist[i] = await db.query(
              `
              SELECT A.BOARD_TITLE
                    ,A.BOARD_HITS
                    ,D.SM_MENU_NAME
                    ,D.SM_MENU_ABB
                    ,A.BOARD_SEQ 
                    ,A.SM_MENU_ID
                    ,A.CREATE_DATE
                    ,B.GOOD_POINT
                    ,B.BAD_POINT
                    ,(
                      SELECT COUNT(*)
                        FROM BOARD_COMMENT B
                       WHERE B.BOARD_SEQ  = A.BOARD_SEQ
                         AND B.SM_MENU_ID = A.SM_MENU_ID
                         AND B.USE_YN     != 'N'
                    ) AS COMMENT_CNT
                    ,CASE WHEN A.BOARD_CONTENT LIKE '%<img%' THEN
                      'Y'
                    ELSE
                      'N'
                    END AS PHOTO_YN
                    ,CASE WHEN A.BOARD_CONTENT LIKE '%<iframe%' THEN
                      'Y'
                    ELSE
                      'N'
                    END AS VIDEO_YN
                FROM BOARD A,
                (
                  SELECT B.SM_MENU_ID
                      ,B.BOARD_SEQ
                      ,MAX(B.GOOD_POINT) AS GOOD_POINT
                      ,MAX(B.BAD_POINT)  AS BAD_POINT
                    FROM ( 
                          SELECT D.SM_MENU_ID
                                    ,D.BOARD_SEQ
                                    ,COALESCE(CASE WHEN D.BOARD_GBN = 'G' THEN
                                      COUNT(*) 
                                    END,0) AS GOOD_POINT
                                    ,COALESCE(CASE WHEN D.BOARD_GBN = 'B' THEN
                                        COUNT(*)
                                    END,0) AS BAD_POINT                      
                                FROM BOARD_STATUS D
                              WHERE D.COMMENT_SEQ IS NULL
                              GROUP BY D.SM_MENU_ID,D.BOARD_SEQ,D.BOARD_GBN
                            ) B
                        GROUP BY B.SM_MENU_ID,B.BOARD_SEQ
              )B
              ,SM_MENU D
              WHERE D.SM_MENU_ID        = $1
              AND A.SM_MENU_ID          = B.SM_MENU_ID
              AND A.BOARD_SEQ           = B.BOARD_SEQ
              AND A.SM_MENU_ID          = D.SM_MENU_ID
              AND A.BOARD_CATEGORY_CODE != 'G'
              AND A.USE_YN              = 'Y'
              AND D.INDEX_YN            = 'Y'
              AND D.STAR_YN             = 'N'
              AND 2 * COALESCE(B.GOOD_POINT,0) - COALESCE(B.BAD_POINT,0)  > 2 
              ORDER BY TO_CHAR(A.CREATE_DATE,'YYYYMMDD') DESC,(B.GOOD_POINT*2-B.BAD_POINT) DESC,A.BOARD_HITS DESC
              LIMIT 5 OFFSET 0
              `
              ,[normalListCnt.rows[i].sm_menu_id]
            )
  
            for(var j = 0 ;  j < normallist[i].rows.length ; j ++){
              if(moment(new Date()).format('YYYYMMDD') === moment(normallist[i].rows[j].create_date).format('YYYYMMDD')){
                normallist[i].rows[j].create_date = moment(normallist[i].rows[j].create_date).fromNow();
              }else{
                normallist[i].rows[j].create_date = moment(normallist[i].rows[j].create_date).format('MM.DD');
              }
            }
    }

    // 일반게시판 쪽 QUERY
   const starListCnt = await db.query(
    `
      SELECT SM_MENU_ID
        FROM SM_MENU 
       WHERE MENU_GBN = 'N'
         AND INDEX_YN = 'Y'
         AND STAR_YN  = 'Y'
    `
   )
  
    for(var i = 0 ; i < starListCnt.rows.length ; i++){
      starlist[i] = await db.query(
            `
            SELECT A.BOARD_TITLE
                  ,A.BOARD_HITS
                  ,D.SM_MENU_NAME
                  ,D.SM_MENU_ABB
                  ,A.BOARD_SEQ 
                  ,A.SM_MENU_ID
                  ,A.CREATE_DATE
                  ,B.GOOD_POINT
                  ,B.BAD_POINT
                  ,A.IMG_PATH
                  ,A.STAR
                  ,(
                    SELECT COUNT(*)
                      FROM BOARD_COMMENT B
                      WHERE B.BOARD_SEQ  = A.BOARD_SEQ
                        AND B.SM_MENU_ID = A.SM_MENU_ID
                        AND B.USE_YN     != 'N'
                  ) AS COMMENT_CNT
                  ,CASE WHEN A.BOARD_CONTENT LIKE '%<iframe%' THEN
                    'Y'
                  ELSE
                    'N'
                  END AS VIDEO_YN
              FROM (
                SELECT A.*
                        ,COALESCE(B.IMG_PATH,'/images/no_img.png') AS IMG_PATH
                  FROM BOARD A LEFT OUTER JOIN BOARD_IMG B 
                  ON A.BOARD_SEQ = B.BOARD_SEQ 
                  AND A.SM_MENU_ID = B.SM_MENU_ID 
                  AND 1 = B.IMG_SEQ
              )A,
              (
                SELECT B.SM_MENU_ID
                    ,B.BOARD_SEQ
                    ,MAX(B.GOOD_POINT) AS GOOD_POINT
                    ,MAX(B.BAD_POINT)  AS BAD_POINT
                  FROM ( 
                        SELECT D.SM_MENU_ID
                                  ,D.BOARD_SEQ
                                  ,COALESCE(CASE WHEN D.BOARD_GBN = 'G' THEN
                                    COUNT(*) 
                                  END,0) AS GOOD_POINT
                                  ,COALESCE(CASE WHEN D.BOARD_GBN = 'B' THEN
                                      COUNT(*)
                                  END,0) AS BAD_POINT                      
                              FROM BOARD_STATUS D
                            WHERE D.COMMENT_SEQ IS NULL
                            GROUP BY D.SM_MENU_ID,D.BOARD_SEQ,D.BOARD_GBN
                          ) B
                      GROUP BY B.SM_MENU_ID,B.BOARD_SEQ
            )B
            ,SM_MENU D
            WHERE D.SM_MENU_ID        = $1
            AND A.SM_MENU_ID          = B.SM_MENU_ID
            AND A.BOARD_SEQ           = B.BOARD_SEQ
            AND A.SM_MENU_ID          = D.SM_MENU_ID
            AND A.BOARD_CATEGORY_CODE != 'G'
            AND A.USE_YN              = 'Y'
            AND D.INDEX_YN            = 'Y'
            AND D.STAR_YN             = 'Y'
            AND 2 * COALESCE(B.GOOD_POINT,0) - COALESCE(B.BAD_POINT,0)  > 2 
            ORDER BY TO_CHAR(A.CREATE_DATE,'YYYYMMDD') DESC,(B.GOOD_POINT*2-B.BAD_POINT) DESC,A.BOARD_HITS DESC
            LIMIT 8 OFFSET 0
            `
            ,[starListCnt.rows[i].sm_menu_id]
          )

          for(var j = 0 ;  j < starlist[i].rows.length ; j ++){
            if(moment(new Date()).format('YYYYMMDD') === moment(starlist[i].rows[j].create_date).format('YYYYMMDD')){
              starlist[i].rows[j].create_date = moment(starlist[i].rows[j].create_date).fromNow();
            }else{
              starlist[i].rows[j].create_date = moment(starlist[i].rows[j].create_date).format('MM.DD');
            }
          }
  }
 
  // 그림게시판 쪽 QUERY
  const imgListCnt = await db.query(
    `
      SELECT SM_MENU_ID
        FROM SM_MENU
      WHERE MENU_GBN = 'P'
        AND INDEX_YN = 'Y'
    `
  )

  for(var i = 0 ; i < imgListCnt.rows.length ; i++){
  imglist[i] = await db.query(
            `
            SELECT A.BOARD_TITLE
                  ,A.BOARD_HITS
                  ,(
                    SELECT E.SM_MENU_NAME
                      FROM SM_MENU E
                    WHERE E.SM_MENU_ID = A.SM_MENU_ID
                  ) AS SM_MENU_NAME
                  ,A.BOARD_SEQ 
                  ,A.SM_MENU_ID
                  ,A.CREATE_DATE
                  ,B.GOOD_POINT
                  ,B.BAD_POINT
                  ,A.IMG_PATH
                  ,(
                    SELECT COUNT(*)
                      FROM BOARD_COMMENT B
                     WHERE B.BOARD_SEQ  = A.BOARD_SEQ
                       AND B.SM_MENU_ID = A.SM_MENU_ID
                       AND B.USE_YN     != 'N'
                  ) AS COMMENT_CNT
              FROM (
              
                  SELECT A.*
                      ,COALESCE(B.IMG_PATH,'/images/no_img.png') AS IMG_PATH
                FROM BOARD A LEFT OUTER JOIN BOARD_IMG B 
                ON A.BOARD_SEQ = B.BOARD_SEQ 
                AND A.SM_MENU_ID = B.SM_MENU_ID 
                AND 1 = B.IMG_SEQ
              )A,
              (
                SELECT B.SM_MENU_ID
                    ,B.BOARD_SEQ
                    ,MAX(B.GOOD_POINT) AS GOOD_POINT
                    ,MAX(B.BAD_POINT)  AS BAD_POINT
                  FROM ( 
                        SELECT D.SM_MENU_ID
                                  ,D.BOARD_SEQ
                                  ,COALESCE(CASE WHEN D.BOARD_GBN = 'G' THEN
                                    COUNT(*) 
                                  END,0) AS GOOD_POINT
                                  ,COALESCE(CASE WHEN D.BOARD_GBN = 'B' THEN
                                      COUNT(*)
                                  END,0) AS BAD_POINT                      
                              FROM BOARD_STATUS D
                            WHERE D.COMMENT_SEQ IS NULL
                            GROUP BY D.SM_MENU_ID,D.BOARD_SEQ,D.BOARD_GBN
                          ) B
                      GROUP BY B.SM_MENU_ID,B.BOARD_SEQ
            )B
            WHERE A.SM_MENU_ID        = $1
            AND A.SM_MENU_ID          = B.SM_MENU_ID
            AND A.BOARD_SEQ           = B.BOARD_SEQ
            AND A.BOARD_CATEGORY_CODE != 'G'
            AND A.USE_YN              = 'Y'
            ORDER BY TO_CHAR(A.CREATE_DATE,'YYYYMMDD') DESC,(B.GOOD_POINT-B.BAD_POINT) DESC,A.BOARD_HITS DESC
            LIMIT 4 OFFSET 0
            `
            ,[imgListCnt.rows[i].sm_menu_id]
          )

          for(var j = 0 ;  j < imglist[i].rows.length ; j ++){
            if(moment(new Date()).format('YYYYMMDD') === moment(imglist[i].rows[j].create_date).format('YYYYMMDD')){
              imglist[i].rows[j].create_date = moment(imglist[i].rows[j].create_date).fromNow();
            }else{
              imglist[i].rows[j].create_date = moment(imglist[i].rows[j].create_date).format('YYYY-MM-DD');
            }
          }
  }

  var recentList     = await side.recentList(req,res,next)
  var mainNoticeList = await side.mainNoticeList(req,res,next)

  // 그림게시판 쪽 QUERY 끝
  res.render('main/index',{imglist:imglist,normallist:normallist,starlist:starlist,recentList:recentList.rows,mainNoticeList:mainNoticeList.rows,user_info:req.user});
});

/**
 * header 세부메뉴 클릭시 세팅
 */
router.post('/idx_hot_list', async function(req, res, next) {
  const { k_hot_seq } = req.body
  let dailyhotList = await db.query(
    `
    SELECT A.BOARD_TITLE
          ,A.BOARD_HITS
          ,(
            SELECT E.SM_MENU_ABB
              FROM SM_MENU E
            WHERE E.SM_MENU_ID = A.SM_MENU_ID
          ) AS SM_MENU_ABB
          ,A.BOARD_SEQ 
          ,A.SM_MENU_ID
          ,A.CREATE_DATE
          ,(
            SELECT COUNT(*)
              FROM BOARD_COMMENT B
            WHERE B.BOARD_SEQ  = A.BOARD_SEQ
              AND B.SM_MENU_ID = A.SM_MENU_ID
          ) AS COMMENT_CNT
          ,CASE WHEN A.BOARD_CONTENT LIKE '%<img%' THEN
            'Y'
          ELSE
            'N'
          END AS PHOTO_YN
          ,CASE WHEN A.BOARD_CONTENT LIKE '%<iframe%' THEN
            'Y'
          ELSE
            'N'
          END AS VIDEO_YN
      FROM BOARD A,
          SM_MENU B
      WHERE 
      A.SM_MENU_ID            = B.SM_MENU_ID
      AND B.MENU_GBN          = 'N'
      AND B.INDEX_YN          = 'Y'
      AND A.USE_YN            = 'Y'
      AND BOARD_CATEGORY_CODE != 'G'
      AND B.STAR_YN           = 'N'
      AND A.BOARD_HITS > 10
      ORDER BY TO_CHAR(A.CREATE_DATE,'YYYYMMDD') DESC, A.BOARD_HITS DESC
      LIMIT 9 OFFSET $1
    `
    ,[(k_hot_seq-1)*9]
  )

  for(var j = 0 ;  j < dailyhotList.rows.length ; j ++){
    if(moment(new Date()).format('YYYYMMDD') === moment(dailyhotList.rows[j].create_date).format('YYYYMMDD')){
      dailyhotList.rows[j].create_date = moment(dailyhotList.rows[j].create_date).fromNow();
    }else{
      dailyhotList.rows[j].create_date = moment(dailyhotList.rows[j].create_date).format('MM.DD');
    }
  }

  res.send({dailyhotList: dailyhotList.rows});
});

/**
 * header 세부메뉴 클릭시 세팅
 */
router.post('/idx_best_list', async function(req, res, next) {
  const { k_best_seq } = req.body
  let dailybestList = await db.query(
    `
    SELECT A.BOARD_TITLE
          ,A.BOARD_HITS
          ,(
            SELECT E.SM_MENU_ABB
              FROM SM_MENU E
            WHERE E.SM_MENU_ID = A.SM_MENU_ID
          ) AS SM_MENU_ABB
          ,A.BOARD_SEQ 
          ,A.SM_MENU_ID
          ,A.CREATE_DATE
          ,B.GOOD_POINT
          ,B.BAD_POINT
          ,(
            SELECT COUNT(*)
              FROM BOARD_COMMENT B
            WHERE B.BOARD_SEQ  = A.BOARD_SEQ
              AND B.SM_MENU_ID = A.SM_MENU_ID
          ) AS COMMENT_CNT
          ,CASE WHEN A.BOARD_CONTENT LIKE '%<img%' THEN
            'Y'
          ELSE
            'N'
          END AS PHOTO_YN
          ,CASE WHEN A.BOARD_CONTENT LIKE '%<iframe%' THEN
            'Y'
          ELSE
            'N'
          END AS VIDEO_YN
      FROM BOARD A,
          (
              SELECT B.SM_MENU_ID
                  ,B.BOARD_SEQ
                  ,MAX(B.GOOD_POINT) AS GOOD_POINT
                  ,MAX(B.BAD_POINT)  AS BAD_POINT
                FROM ( 
                      SELECT D.SM_MENU_ID
                                ,D.BOARD_SEQ
                                ,COALESCE(CASE WHEN D.BOARD_GBN = 'G' THEN
                                  COUNT(*) 
                                END,0) AS GOOD_POINT
                                ,COALESCE(CASE WHEN D.BOARD_GBN = 'B' THEN
                                    COUNT(*)
                                END,0) AS BAD_POINT                      
                            FROM BOARD_STATUS D
                          WHERE D.COMMENT_SEQ IS NULL
                          GROUP BY D.SM_MENU_ID,D.BOARD_SEQ,D.BOARD_GBN
                        ) B
                    GROUP BY B.SM_MENU_ID,B.BOARD_SEQ
          )B,
          SM_MENU C
      WHERE A.SM_MENU_ID        = B.SM_MENU_ID
      AND A.BOARD_SEQ         = B.BOARD_SEQ
      AND A.SM_MENU_ID        = C.SM_MENU_ID
      AND C.MENU_GBN          = 'N'
      AND C.INDEX_YN          = 'Y'
      AND A.USE_YN            = 'Y'
      AND C.STAR_YN           = 'N'
      AND BOARD_CATEGORY_CODE != 'G'
      AND (B.GOOD_POINT*2-B.BAD_POINT) > 3
      ORDER BY TO_CHAR(A.CREATE_DATE,'YYYYMMDD') DESC,(B.GOOD_POINT*2-B.BAD_POINT) DESC,A.BOARD_HITS DESC
      LIMIT 9 OFFSET $1
    `
    ,[(k_best_seq-1)*9]
  )

  for(var j = 0 ;  j < dailybestList.rows.length ; j ++){
    if(moment(new Date()).format('YYYYMMDD') === moment(dailybestList.rows[j].create_date).format('YYYYMMDD')){
      dailybestList.rows[j].create_date = moment(dailybestList.rows[j].create_date).fromNow();
    }else{
      dailybestList.rows[j].create_date = moment(dailybestList.rows[j].create_date).format('MM.DD');
    }
  }

  res.send({dailybestList: dailybestList.rows});
});

router.post('/new_message_yn', async function(req, res, next) {
  if(!req.user){
    res.send({messageCnt:null})  
  }else{
  const messageCnt =  await db.query(
      `
        SELECT COUNT(*) CNT
          FROM MESSAGE
         WHERE TO_USER_ID = $1
           AND READ_YN    = 'N'
      `
      ,[req.user.user_id]
    )
  res.send({messageCnt:messageCnt.rows[0].cnt})
  }
});
module.exports = router;
