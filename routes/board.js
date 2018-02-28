var express   = require('express');
var db        = require('./db');
var path      = require('path');
var crypto    = require('crypto'); //암호화
var moment    = require('moment'); //시간 
var ipaddr    = require('ipaddr.js');
var save      = require('summernote-nodejs'); //서머노트
var multer    = require('multer');
var fs        = require('fs');
var autoLogin = require('./autoLogin');
var side      = require('./side');
var visitCount = require('./visitCount');
var upload = multer({ 
    limits : { fileSize: 10 * 1024 * 1024},
    storage: multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
      },
      filename: function (req, file, cb) {
        cb(null, new Date().valueOf() + path.extname(file.originalname));
      },
    }),
}).single('file');
moment.locale('ko');
var router    = express.Router();

/**
 *  댓글 list 함수
 */
const commentList = async function(req, res, next){
  let commentList = await db.query(
    `
      WITH RECURSIVE PARENT_COMMENT (P_LEVEL
                                  ,COMMENT_SEQ
                                  ,COMMENT_CONTENT
                                  ,CREATE_ID
                                  ,NICK_NAME
                                  ,USER_YN
                                  ,USE_YN
                                  ,PARENT_COMMENT_SEQ
                                  ,PATH
                                  ,CYCLE
                                  ,CREATE_DATE
                                  ,BOARD_SEQ
                                  ,SM_MENU_ID
                                  ,USER_ID
                                  ,CREATE_IP
                                  )
    AS ( SELECT 1 AS P_LEVEL 
              ,COMMENT_SEQ
              ,COMMENT_CONTENT
              ,CREATE_ID
              ,NICK_NAME
              ,USER_YN
              ,USE_YN
              ,PARENT_COMMENT_SEQ
              ,ARRAY[COMMENT_SEQ]
              ,FALSE
              ,CREATE_DATE
              ,BOARD_SEQ
              ,SM_MENU_ID
              ,USER_ID
              ,CREATE_IP
              FROM BOARD_COMMENT
              WHERE PARENT_COMMENT_SEQ IS NULL
    UNION ALL
        SELECT P_LEVEL + 1
                ,E.COMMENT_SEQ
                ,E.COMMENT_CONTENT
                ,E.CREATE_ID
                ,E.NICK_NAME
                ,E.USER_YN
                ,E.USE_YN
                ,E.PARENT_COMMENT_SEQ
                ,PATH||E.COMMENT_SEQ
                ,E.COMMENT_SEQ=ANY(PATH)
                ,E.CREATE_DATE
                ,E.BOARD_SEQ
                ,E.SM_MENU_ID
                ,E.USER_ID
                ,E.CREATE_IP
                FROM BOARD_COMMENT E, PARENT_COMMENT H
                WHERE E.PARENT_COMMENT_SEQ = H.COMMENT_SEQ AND NOT CYCLE
                  AND E.SM_MENU_ID         = H.SM_MENU_ID
                  AND E.BOARD_SEQ          = H.BOARD_SEQ
          )
    SELECT A.P_LEVEL              AS P_LEVEL
          ,A.COMMENT_SEQ          AS COMMENT_SEQ
          ,CASE WHEN A.USE_YN = 'R' THEN
            '관리자에 의해 삭제된 글입니다.'
           ELSE
           A.COMMENT_CONTENT
           END
                                AS COMMENT_CONTENT
          ,A.PARENT_COMMENT_SEQ   AS PARENT_COMMENT_SEQ
          ,A.CREATE_DATE          AS CREATE_DATE
          ,A.NICK_NAME            AS NICK_NAME  
          ,A.USER_YN              AS USER_YN
          ,A.USER_ID              AS USER_ID
          ,B.USER_GRADE           AS USER_GRADE
          ,A.CREATE_IP            AS CREATE_IP
          ,COALESCE(A.GOOD_GBN,0) AS GOOD_GBN
          ,COALESCE(A.BAD_GBN,0)  AS BAD_GBN
          ,(
            SELECT CASE
                      WHEN C.USER_GRADE = 'BRAHMAN'
                      THEN 'master.png'
                      WHEN C.USER_GRADE = 'KSHATRIYA'
                      THEN 'supernamed.png'
                      WHEN C.USER_GRADE = 'VAISHYA'
                      THEN 'named.png'
                      WHEN C.USER_GRADE = 'SHUDRA'
                      THEN 'user.png'
                  END
              FROM ONEJUMIN_USER C
             WHERE C.USER_ID = A.USER_ID 
          ) AS USER_IMG
          ,B.USER_PHOTO
      FROM ( 
             SELECT A.*
                  ,B.GOOD_GBN
                  ,B.BAD_GBN
               FROM PARENT_COMMENT A LEFT OUTER JOIN(
                SELECT B.SM_MENU_ID
                        ,B.BOARD_SEQ
                        ,B.COMMENT_SEQ
                        ,COALESCE(MAX(BAD_GBN),0)    AS BAD_GBN
                        ,COALESCE(MAX(GOOD_GBN),0)   AS GOOD_GBN
                  FROM (
                      SELECT  B.SM_MENU_ID 
                          , B.BOARD_SEQ
                          , B.COMMENT_SEQ
                          , CASE WHEN B.BOARD_GBN = 'B'
                            THEN SUM(1)
                            END AS BAD_GBN
                          , CASE WHEN B.BOARD_GBN = 'G'
                            THEN SUM(1)
                            END AS GOOD_GBN
                      FROM BOARD_STATUS B
                      WHERE B.COMMENT_SEQ  IS NOT NULL
                      GROUP BY B.SM_MENU_ID , B.BOARD_SEQ , B.BOARD_GBN, B.COMMENT_SEQ
                    ) B
                GROUP BY B.SM_MENU_ID , B.BOARD_SEQ, B.COMMENT_SEQ
              ) B
              ON A.SM_MENU_ID = B.SM_MENU_ID
              AND A.BOARD_SEQ = B.BOARD_SEQ
              AND A.COMMENT_SEQ = B.COMMENT_SEQ
            ) A LEFT OUTER JOIN ONEJUMIN_USER  B
           ON A.USER_ID = B.USER_ID 
     WHERE A.SM_MENU_ID = $1 
       AND A.BOARD_SEQ  = $2
       AND A.USE_YN     != 'N'
     ORDER BY PATH
    `
    ,[req.param('sm_menu_id'),req.param('board_seq')]
  )

  let commentBestList = await db.query(
    `
      WITH RECURSIVE PARENT_COMMENT (P_LEVEL
                                  ,COMMENT_SEQ
                                  ,COMMENT_CONTENT
                                  ,CREATE_ID
                                  ,NICK_NAME
                                  ,USER_YN
                                  ,USE_YN
                                  ,PARENT_COMMENT_SEQ
                                  ,PATH
                                  ,CYCLE
                                  ,CREATE_DATE
                                  ,BOARD_SEQ
                                  ,SM_MENU_ID
                                  ,USER_ID
                                  ,CREATE_IP
                                  )
    AS ( SELECT 1 AS P_LEVEL 
              ,COMMENT_SEQ
              ,COMMENT_CONTENT
              ,CREATE_ID
              ,NICK_NAME
              ,USER_YN
              ,USE_YN
              ,PARENT_COMMENT_SEQ
              ,ARRAY[COMMENT_SEQ]
              ,FALSE
              ,CREATE_DATE
              ,BOARD_SEQ
              ,SM_MENU_ID
              ,USER_ID
              ,CREATE_IP
              FROM BOARD_COMMENT
              WHERE PARENT_COMMENT_SEQ IS NULL
    UNION ALL
        SELECT P_LEVEL + 1
                ,E.COMMENT_SEQ
                ,E.COMMENT_CONTENT
                ,E.CREATE_ID
                ,E.NICK_NAME
                ,E.USER_YN
                ,E.USE_YN
                ,E.PARENT_COMMENT_SEQ
                ,PATH||E.COMMENT_SEQ
                ,E.COMMENT_SEQ=ANY(PATH)
                ,E.CREATE_DATE
                ,E.BOARD_SEQ
                ,E.SM_MENU_ID
                ,E.USER_ID
                ,E.CREATE_IP
                FROM BOARD_COMMENT E, PARENT_COMMENT H
                WHERE E.PARENT_COMMENT_SEQ = H.COMMENT_SEQ AND NOT CYCLE
                  AND E.SM_MENU_ID         = H.SM_MENU_ID
                  AND E.BOARD_SEQ          = H.BOARD_SEQ
          )
    SELECT A.P_LEVEL              AS P_LEVEL
          ,A.COMMENT_SEQ          AS COMMENT_SEQ
          ,CASE WHEN A.USE_YN = 'R' THEN
            '관리자에 의해 삭제된 글입니다.'
           ELSE
           A.COMMENT_CONTENT
           END
                                AS COMMENT_CONTENT
          ,A.PARENT_COMMENT_SEQ   AS PARENT_COMMENT_SEQ
          ,A.CREATE_DATE          AS CREATE_DATE
          ,A.NICK_NAME            AS NICK_NAME  
          ,A.USER_YN              AS USER_YN
          ,A.USER_ID              AS USER_ID
          ,B.USER_GRADE           AS USER_GRADE
          ,A.CREATE_IP            AS CREATE_IP
          ,COALESCE(A.GOOD_GBN,0) AS GOOD_GBN
          ,COALESCE(A.BAD_GBN,0)  AS BAD_GBN
          ,(
            SELECT CASE
                      WHEN C.USER_GRADE = 'BRAHMAN'
                      THEN 'master.png'
                      WHEN C.USER_GRADE = 'KSHATRIYA'
                      THEN 'supernamed.png'
                      WHEN C.USER_GRADE = 'VAISHYA'
                      THEN 'named.png'
                      WHEN C.USER_GRADE = 'SHUDRA'
                      THEN 'user.png'
                  END
              FROM ONEJUMIN_USER C
             WHERE C.USER_ID = A.USER_ID 
          ) AS USER_IMG
          ,B.USER_PHOTO
      FROM ( 
             SELECT A.*
                  ,B.GOOD_GBN
                  ,B.BAD_GBN
               FROM PARENT_COMMENT A LEFT OUTER JOIN(
                SELECT B.SM_MENU_ID
                        ,B.BOARD_SEQ
                        ,B.COMMENT_SEQ
                        ,COALESCE(MAX(BAD_GBN),0)    AS BAD_GBN
                        ,COALESCE(MAX(GOOD_GBN),0)   AS GOOD_GBN
                  FROM (
                      SELECT  B.SM_MENU_ID 
                          , B.BOARD_SEQ
                          , B.COMMENT_SEQ
                          , CASE WHEN B.BOARD_GBN = 'B'
                            THEN SUM(1)
                            END AS BAD_GBN
                          , CASE WHEN B.BOARD_GBN = 'G'
                            THEN SUM(1)
                            END AS GOOD_GBN
                      FROM BOARD_STATUS B
                      WHERE B.COMMENT_SEQ  IS NOT NULL
                      GROUP BY B.SM_MENU_ID , B.BOARD_SEQ , B.BOARD_GBN, B.COMMENT_SEQ
                    ) B
                GROUP BY B.SM_MENU_ID , B.BOARD_SEQ, B.COMMENT_SEQ
              ) B
              ON A.SM_MENU_ID = B.SM_MENU_ID
              AND A.BOARD_SEQ = B.BOARD_SEQ
              AND A.COMMENT_SEQ = B.COMMENT_SEQ
            ) A LEFT OUTER JOIN ONEJUMIN_USER  B
           ON A.USER_ID = B.USER_ID 
     WHERE A.SM_MENU_ID = $1 
       AND A.BOARD_SEQ  = $2
       AND A.USE_YN     != 'N'
       AND A.PARENT_COMMENT_SEQ IS NULL
       AND COALESCE(A.GOOD_GBN,0)*2 - COALESCE(A.BAD_GBN,0) > 10
    ORDER BY (COALESCE(A.GOOD_GBN,0)*2 - COALESCE(A.BAD_GBN,0)) DESC,PATH
     LIMIT 3 OFFSET 0
    `
    ,[req.param('sm_menu_id'),req.param('board_seq')]
  )

  var rtnJson = {
      rtn_commentList     : commentList.rows,
      rtn_commentBestList : commentBestList.rows
  }
  return rtnJson;
}

const insertReact = async function(req, res, next,commentSeq){
  let {k_menuId,k_boardSeq,k_commentNickName,k_commnetPassword,k_recommentParentSeq,k_commentContent } = req.body
  let ip =  ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
  let board_user = ''

  /* 게시판에대한 반응인지 댓글에 대한 반응인지 체크 */
  if(k_recommentParentSeq == null){
    board_user = await db.query(
      `
        SELECT 'C'           AS REACT_GBN
              ,A.USER_YN     AS USER_YN
              ,A.USER_ID     AS USER_ID
              ,A.BOARD_TITLE AS MY_CONTENT
          FROM BOARD A
               ,ONEJUMIN_USER B
         WHERE A.USER_ID    = B.USER_ID
           AND A.SM_MENU_ID = $1
           AND A.BOARD_SEQ  = $2
      `
      ,[k_menuId,k_boardSeq]
    )
  }else{
     board_user = await db.query(
      `
        SELECT 'R'               AS REACT_GBN
              ,A.USER_YN         AS USER_YN
              ,A.USER_ID         AS USER_ID
              ,A.COMMENT_CONTENT AS MY_CONTENT
          FROM BOARD_COMMENT A
              ,ONEJUMIN_USER B
         WHERE A.USER_ID    = B.USER_ID
           AND A.SM_MENU_ID = $1
           AND A.BOARD_SEQ  = $2
           AND A.COMMENT_SEQ = $3
      `
      ,[k_menuId,k_boardSeq,k_recommentParentSeq]
    )
  }

  if(board_user.rows.length > 0 ){
    if(board_user.rows[0].user_yn == 'Y'){
      /* 자기글에 자기가 댓글달면 자기반응글 생성안함 */
      if(req.user){
        if(req.user.user_id == board_user.rows[0].user_id){
          return;
        }
      }
      /* 자기글에 자기가 댓글달면 자기반응글 생성안함 */
      let commentList = await db.query(
        `
          INSERT INTO BOARD_REACT
          (
            SM_MENU_ID   
            ,BOARD_SEQ
            ,COMMENT_SEQ
            ,USER_ID
            ,REACT_GBN
            ,MY_CONTENT   
            ,REACT_CONTENT
            ,READ_YN      
            ,CREATE_IP    
            ,CREATE_DATE  
            ,UPDATE_IP    
            ,UPDATE_DATE  
          )
          VALUES(
            $1
            ,$2
            ,$3
            ,$4
            ,$5
            ,$6
            ,$7
            ,$8
            ,$9
            ,timezone('KST'::text, now())
            ,$10
            ,timezone('KST'::text, now())
          )
        `
        ,[
          k_menuId
          ,k_boardSeq
          ,commentSeq
          ,board_user.rows[0].user_id
          ,board_user.rows[0].react_gbn
          ,board_user.rows[0].my_content
          ,k_commentContent
          ,'N'
          ,ip
          ,ip
        ]
      )
    }
  }
}

/**
 *  좋아요 반대 개수 찾는 함수 
 */
const upDonwCnt = async function(req, res, next){
  let upDonwCntList = await db.query(
    `
      SELECT (SELECT COUNT(*)     
                FROM BOARD_STATUS B
                WHERE B.BOARD_SEQ          = $1
                  AND B.COMMENT_SEQ        IS NULL
                  AND B.BOARD_GBN          = 'G'
                  AND B.SM_MENU_ID         = $2
              )                      AS GOOD_COUNT
            ,(SELECT COUNT(*) 
                FROM BOARD_STATUS B
                WHERE B.BOARD_SEQ          = $1
                  AND B.COMMENT_SEQ        IS NULL
                  AND B.BOARD_GBN          = 'B'
                  AND B.SM_MENU_ID         = $2
              )                      AS BAD_COUNT
    `
    ,[req.param('k_boardSeq'),req.param('k_menuId')]
  )

  var rtnJson = {
    rtn_upDonwCntList    : upDonwCntList.rows
  }
  return rtnJson;
}

/**
 *  게시판 삭제 함수 
 */
const boarDel = async function(req, res, next){
  var ip =  ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
  var use_yn = req.param('k_admin_yn')
  await db.query(
    `
      UPDATE BOARD SET
      USE_YN        = $5
      ,UPDATE_ID    = $1
      ,UPDATE_DATE  = timezone('KST'::text, now())
      ,UPDATE_IP    = $2
      WHERE SM_MENU_ID = $3
        AND BOARD_SEQ  = $4
    `
    ,[req.param('user_id'),ip,req.param('k_menuId'),req.param('k_boardSeq'),use_yn]
  )
}

/**
 *  댓글 삭제 
 */
const commentDel = async function(req, res, next){
  var ip =  ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
  var use_yn = req.param('k_use_yn')
  await db.query(
    `
      UPDATE BOARD_COMMENT SET
      USE_YN        = $6
      ,UPDATE_ID    = $1
      ,UPDATE_DATE  = timezone('KST'::text, now())
      ,UPDATE_IP    = $2
      WHERE SM_MENU_ID   = $3
        AND BOARD_SEQ    = $4
        AND COMMENT_SEQ  = $5
    `
    ,[req.param('user_id'),ip,req.param('k_menuId'),req.param('k_boardSeq'),req.param('k_commentSeq'),use_yn]
  )

  if(use_yn === 'N'){
    await db.query(
      `
        UPDATE BOARD_COMMENT SET
        USE_YN        = 'N'
        ,UPDATE_ID    = $1
        ,UPDATE_DATE  = timezone('KST'::text, now())
        ,UPDATE_IP    = $2
        WHERE SM_MENU_ID   = $3
          AND BOARD_SEQ    = $4
          AND PARENT_COMMENT_SEQ = $5
      `
      ,[req.param('user_id'),ip,req.param('k_menuId'),req.param('k_boardSeq'),req.param('k_commentSeq')]
    )
  }

  await db.query(
    `
      DELETE 
        FROM BOARD_REACT
       WHERE SM_MENU_ID   = $1
       AND BOARD_SEQ    = $2
       AND COMMENT_SEQ  = $3
    `
    ,[req.param('k_menuId'),req.param('k_boardSeq'),req.param('k_commentSeq')]
  )
}
/**
 * 게시판리스트 공통(리스트 화면 , 상세 밑에)
 */
const boardList = async function(req, res, next){
  var page = 1;
  var sort = req.param("sort")==null?"D":req.param("sort")
  var orderBy = ''
  var where   = ''
  if(sort === "D"){
    orderBy = `ORDER BY A.CREATE_DATE DESC`
    where   = ''
  }else{
    orderBy = `
                ORDER BY
                TO_CHAR(A.CREATE_DATE,'YYYYMMDD') DESC,
                2 * COALESCE(B.GOOD_GBN,0) - COALESCE(B.BAD_GBN,0) DESC,
                A.BOARD_HITS DESC
              `
    where   = `
                AND 2 * COALESCE(B.GOOD_GBN,0) - COALESCE(B.BAD_GBN,0)  > 2 
                AND A.USE_YN = 'Y'
              `
  }
  var pg = req.param("pg");    			    	
  if(pg != null && !pg == ""){
    page = Number(pg);
  }
  var field = req.param("search") == null ?'':req.param("search");
  var srow = 0+ (page-1)*15;

  const boardnotiList = await db.query(
    `SELECT BOARD_SEQ               AS BOARD_SEQ       
            ,BOARD_CATEGORY_CODE    AS BOARD_CATEGORY_CODE
            ,CASE WHEN USE_YN = 'R' THEN 
              '관리자에 의해 삭제된 글입니다.'
            ELSE
              BOARD_TITLE
            END                     AS BOARD_TITLE
            ,USER_ID                AS USER_ID   
            ,NICK_NAME              AS NICK_NAME   
            ,CREATE_DATE            AS CREATE_DATE
            ,SM_MENU_ID             AS SM_MENU_ID
            ,BOARD_HITS             AS BOARD_HITS
            ,(SELECT COUNT(*)     
                FROM BOARD_STATUS B
              WHERE B.BOARD_SEQ          = A.BOARD_SEQ
                AND B.COMMENT_SEQ        IS NULL
                AND B.BOARD_GBN          = 'G'
                AND B.SM_MENU_ID         = A.SM_MENU_ID
            )                      AS GOOD_GBN
            ,(SELECT COUNT(*) 
                FROM BOARD_STATUS B
              WHERE B.BOARD_SEQ          = A.BOARD_SEQ
                AND B.COMMENT_SEQ        IS NULL
                AND B.BOARD_GBN          = 'B'
                AND B.SM_MENU_ID         = A.SM_MENU_ID
            )                      AS BAD_GBN
            ,(
              SELECT COUNT(*)
                FROM BOARD_COMMENT B
               WHERE B.BOARD_SEQ  = A.BOARD_SEQ
                 AND B.SM_MENU_ID = A.SM_MENU_ID
                 AND B.USE_YN     != 'N'
            )                     AS COMMENT_CNT
            ,(
              SELECT CASE
                        WHEN C.USER_GRADE = 'BRAHMAN'
                        THEN 'master.png'
                        WHEN C.USER_GRADE = 'KSHATRIYA'
                        THEN 'supernamed.png'
                        WHEN C.USER_GRADE = 'VAISHYA'
                        THEN 'named.png'
                        WHEN C.USER_GRADE = 'SHUDRA'
                        THEN 'user.png'
                    END
                FROM ONEJUMIN_USER C
               WHERE C.USER_ID = A.USER_ID 
            ) AS USER_IMG
        FROM BOARD A 
        WHERE SM_MENU_ID = $1
        AND USE_YN != 'N'
        AND BOARD_CATEGORY_CODE = 'G'
        ORDER BY CREATE_DATE DESC
        LIMIT 3 OFFSET 0
        `
        ,[req.param('sm_menu_id')]
  )
  const boardList = await db.query(
    `SELECT A.BOARD_SEQ               AS BOARD_SEQ       
            ,A.BOARD_CATEGORY_CODE    AS BOARD_CATEGORY_CODE
            ,CASE WHEN A.USE_YN = 'R' THEN 
              '관리자에 의해 삭제된 글입니다.'
            ELSE
              A.BOARD_TITLE
            END                       AS BOARD_TITLE
            ,A.USER_ID                AS USER_ID   
            ,A.NICK_NAME              AS NICK_NAME   
            ,A.CREATE_DATE            AS CREATE_DATE
            ,A.SM_MENU_ID             AS SM_MENU_ID
            ,A.BOARD_HITS             AS BOARD_HITS
            ,COALESCE(B.GOOD_GBN,0)   AS GOOD_GBN
            ,COALESCE(B.BAD_GBN,0)    AS BAD_GBN
            ,A.BOARD_CATEGORY_NAME    AS BOARD_CATEGORY_NAME
            ,A.BOARD_CATEGORY_CODE    AS BOARD_CATEGORY_CODE
            ,A.STAR                   AS STAR
            ,(
            SELECT COUNT(*)
              FROM BOARD_COMMENT B
              WHERE B.BOARD_SEQ  = A.BOARD_SEQ
                AND B.SM_MENU_ID = A.SM_MENU_ID
                AND B.USE_YN     != 'N'
            )                     AS COMMENT_CNT
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
            ,(
              SELECT CASE
                        WHEN C.USER_GRADE = 'BRAHMAN'
                        THEN 'master.png'
                        WHEN C.USER_GRADE = 'KSHATRIYA'
                        THEN 'supernamed.png'
                        WHEN C.USER_GRADE = 'VAISHYA'
                        THEN 'named.png'
                        WHEN C.USER_GRADE = 'SHUDRA'
                        THEN 'user.png'
                    END
                FROM ONEJUMIN_USER C
               WHERE C.USER_ID = A.USER_ID 
            ) AS USER_IMG
            ,CASE WHEN  A.USE_YN != 'R' THEN
            COALESCE(
                ( 
                  SELECT B.IMG_PATH
                    FROM BOARD_IMG B 
                  WHERE A.BOARD_SEQ = B.BOARD_SEQ
                  AND A.SM_MENU_ID = B.SM_MENU_ID
                  AND 1 = B.IMG_SEQ
                )
            ,'/images/no_img.png') 
            ELSE 
              '/images/report_img.png'
            END   AS IMG_PATH
       FROM 
            (SELECT A.*
                   ,B.BOARD_CATEGORY_NAME
               FROM BOARD A
                    ,CODE_MASTER B
              WHERE A.BOARD_CATEGORY_CODE = B.BOARD_CATEGORY_CODE
            ) A LEFT OUTER JOIN
            (
              SELECT B.SM_MENU_ID
                      ,B.BOARD_SEQ
                      ,COALESCE(MAX(BAD_GBN),0)    AS BAD_GBN
                      ,COALESCE(MAX(GOOD_GBN),0)   AS GOOD_GBN
                FROM (
                    SELECT  B.SM_MENU_ID 
                        , B.BOARD_SEQ
                        , CASE WHEN B.BOARD_GBN = 'B'
                          THEN SUM(1)
                          END AS BAD_GBN
                        , CASE WHEN B.BOARD_GBN = 'G'
                          THEN SUM(1)
                          END AS GOOD_GBN
                    FROM BOARD_STATUS B
                    WHERE B.COMMENT_SEQ  IS NULL
                    GROUP BY B.SM_MENU_ID , B.BOARD_SEQ , B.BOARD_GBN
                  ) B
              GROUP BY B.SM_MENU_ID , B.BOARD_SEQ
            ) B
            ON A.SM_MENU_ID = B.SM_MENU_ID
            AND A.BOARD_SEQ = B.BOARD_SEQ
      WHERE A.SM_MENU_ID = $1
        AND A.USE_YN != 'N'
    `
      +
       where
      +
    `
        AND A.BOARD_CATEGORY_CODE != 'G'
        AND (
                 A.BOARD_TITLE   LIKE '%'||$3||'%'
              OR A.BOARD_CONTENT LIKE '%'||$3||'%'
            )
    `
    +
    orderBy
    +
    `
      LIMIT 15 OFFSET $2
    `
    ,[req.param('sm_menu_id'),srow,field]
  )

  const pageList = await db.query(
    `SELECT COUNT(*) CNT
       FROM BOARD A  LEFT OUTER JOIN
        (
          SELECT B.SM_MENU_ID
                  ,B.BOARD_SEQ
                  ,COALESCE(MAX(BAD_GBN),0)    AS BAD_GBN
                  ,COALESCE(MAX(GOOD_GBN),0)   AS GOOD_GBN
            FROM (
                SELECT  B.SM_MENU_ID 
                    , B.BOARD_SEQ
                    , CASE WHEN B.BOARD_GBN = 'B'
                      THEN SUM(1)
                      END AS BAD_GBN
                    , CASE WHEN B.BOARD_GBN = 'G'
                      THEN SUM(1)
                      END AS GOOD_GBN
                FROM BOARD_STATUS B
                WHERE B.COMMENT_SEQ  IS NULL
                GROUP BY B.SM_MENU_ID , B.BOARD_SEQ , B.BOARD_GBN
              ) B
          GROUP BY B.SM_MENU_ID , B.BOARD_SEQ
        ) B
       ON A.SM_MENU_ID = B.SM_MENU_ID
       AND A.BOARD_SEQ = B.BOARD_SEQ
    WHERE A.SM_MENU_ID = $1
      AND A.USE_YN != 'N'
      AND (
                A.BOARD_TITLE   LIKE '%'||$2||'%'
            OR  A.BOARD_CONTENT LIKE '%'||$2||'%'
          )
      AND A.BOARD_CATEGORY_CODE != 'G'
    `+ where
    ,[req.param('sm_menu_id'),field]
  )

  const write_yn = await db.query(
    `
      SELECT COALESCE(WRITE_YN,'Y') AS WRITE_YN
             ,COALESCE(MENU_GBN,'N') AS MENU_GBN
        FROM SM_MENU
       WHERE SM_MENU_ID = $1
    `
    ,[req.param('sm_menu_id')]
  )

  var cnt   = pageList.rows[0].cnt == 0?1:pageList.rows[0].cnt;
  //var cnt   = boardList.rows.length
  var start = page - (page-1)%5;  
  var end   = Math.floor(cnt/15) + (cnt%15 == 0?0:1);

  for(var i = 0 ; i < boardList.rows.length ; i ++){
    if(moment(new Date()).format('YYYYMMDD') === moment(boardList.rows[i].create_date).format('YYYYMMDD')){
      boardList.rows[i].create_date = moment(boardList.rows[i].create_date).fromNow();
    }else{
      boardList.rows[i].create_date = moment(boardList.rows[i].create_date).format('YYYY-MM-DD');
    }
  }

  for(var i = 0 ; i < boardnotiList.rows.length ; i ++){
    if(moment(new Date()).format('YYYYMMDD') === moment(boardnotiList.rows[i].create_date).format('YYYYMMDD')){
      boardnotiList.rows[i].create_date = moment(boardnotiList.rows[i].create_date).fromNow();
    }else{
      boardnotiList.rows[i].create_date = moment(boardnotiList.rows[i].create_date).format('YYYY-MM-DD');
    }
  }

  
  var rtnJson = {
                  boardList       : boardList.rows
                  ,boardnotiList  : boardnotiList.rows
                  ,sm_menu_id     : req.param('sm_menu_id')
                  ,cnt            : cnt
                  ,pg             : page
                  ,search         : field
                  ,start          : start
                  ,end            : end
                  ,sort           : sort
                  ,write_yn       : write_yn.rows[0].write_yn
                  ,menu_gbn       : write_yn.rows[0].menu_gbn
              }

  return rtnJson;
}

/** 자동로그인 */
router.all('/list', function(req,res,next){
  visitCount.visitLog(req,res,next);
  autoLogin.autoLogin(req,res,next);
}
)

/**
 * 게시판 리스트
 */
router.get('/list', async function(req, res, next) {
  var recentList     = await side.recentList(req,res,next)
  var mainNoticeList = await side.mainNoticeList(req,res,next)
  boardList(req, res, next).then(
      function(rtnList){
        res.render('./board/list',{boardList      : rtnList.boardList
          ,boardnotiList  : rtnList.boardnotiList
          ,sm_menu_id     : req.param('sm_menu_id')
          ,cnt            : rtnList.cnt
          ,pg             : rtnList.pg
          ,search         : rtnList.search
          ,start          : rtnList.start
          ,end            : rtnList.end
          ,sort           : rtnList.sort
          ,errMsg         : req.flash('errMsg')
          ,write_yn       : rtnList.write_yn
          ,menu_gbn       : rtnList.menu_gbn
          ,user_info      : req.user
          ,recentList     : recentList.rows
          ,mainNoticeList : mainNoticeList.rows
        });     
    }
  )
});

/** 자동로그인 */
router.all('/edit', function(req,res,next){
  visitCount.visitLog(req,res,next);
  autoLogin.autoLogin(req,res,next);
}
)

/**
 * 게시판 글 생성 페이지 이동
 */
router.get('/edit', async function(req, res, next) {
  
  const ynlist = await db.query(
    `
      SELECT COALESCE(WRITE_YN,'Y') as WRITE_YN
             ,COALESCE(STAR_YN ,'N') as STAR_YN
        FROM SM_MENU
      WHERE SM_MENU_ID = $1
    `
  ,[req.param('sm_menu_id')]
  )

  if(ynlist.rows[0].write_yn == 'N' && !req.user){
    res.render('main/error',{user_info   : req.user})
  }
  if(ynlist.rows[0].write_yn == 'N' && (req.user.user_grade != 'BRAHMAN') ){
    res.render('main/error',{user_info   : req.user})
  }

  const categoryList = await db.query(
    `
      SELECT BOARD_CATEGORY_CODE AS BOARD_CATEGORY_CODE
            ,BOARD_CATEGORY_NAME AS BOARD_CATEGORY_NAME
        FROM CODE_MAPPING
       WHERE SM_MENU_ID = $1
         AND (
              USER_GRADE = 'ALL'
              OR USER_GRADE = $2
       )
    `
  ,[
     req.param('sm_menu_id')
    ,req.user==null?'':req.user.user_grade
   ]
  )

  res.render('./board/edit', {
                               sm_menu_id:req.param('sm_menu_id')
                              ,star_yn:ynlist.rows[0].star_yn
                              ,user_info : req.user
                              ,categoryList:categoryList.rows
                             }
            );
});

/**
 * 게시판 글 생성
 */
router.post('/edit', function(req, res, next) {
  var ip =  ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
  const{sm_menu_id,board_category_code,board_title,board_content,nick_name,board_password,star,dig_code,origin} = req.body
  db.query(
    `
    SELECT 
    (SELECT COUNT(*) AS CNT
      FROM BOARD
      WHERE CREATE_IP = $1
        AND USER_YN = 'N'
        AND TO_CHAR(timezone('KST'::text, now()),'YYYYMMDD') = TO_CHAR(CREATE_DATE,'YYYYMMDD')
     ) AS CNT
     ,
     ( SELECT COUNT(*)  AS CNT
        FROM USER_IP_BAN
        WHERE END_DATE > timezone('KST'::text, now())
          AND START_DATE < timezone('KST'::text, now())
          AND USER_IP  = $1
     ) AS BLOCK_CNT
     ,
     ( SELECT TO_CHAR(END_DATE,'YYYY-MM-DD HH24:MI:SS') 
        FROM USER_IP_BAN
        WHERE END_DATE > timezone('KST'::text, now())
          AND START_DATE < timezone('KST'::text, now())
          AND USER_IP  = $1
     ) AS END_DATE 
    `
    ,[ip]
  ).then(function(cntList){
    if( cntList.rows[0].block_cnt > 0 ){
      req.flash('errMsg','쓰기 정지된 대상입니다. 정지 해제 시간 '+ cntList.rows[0].end_date);
      res.redirect('/board/list?sm_menu_id='+req.param('sm_menu_id'));
    }
    else if((cntList.rows[0].cnt >= 2) && !req.user){
      req.flash('errMsg','비회원은 하루에 2개의 글을 작성할 수 있습니다.');
      res.redirect('/board/list?sm_menu_id='+req.param('sm_menu_id'));
    }else{
      db.query(
        `
          SELECT COALESCE(MAX(BOARD_SEQ),0) + 1 as board_seq
          FROM  BOARD
          WHERE SM_MENU_ID = $1
        `
        ,[sm_menu_id]
      ).then(
        function(boardSeqList){
          let boardSeq = boardSeqList.rows[0].board_seq
          db.query(
            `
            INSERT INTO BOARD(
              BOARD_SEQ          
              ,SM_MENU_ID         
              ,BOARD_CATEGORY_CODE
              ,BOARD_TITLE        
              ,BOARD_CONTENT      
              ,USER_ID            
              ,NICK_NAME          
              ,PASSWORD           
              ,USER_YN            
              ,USER_GRADE         
              ,USE_YN             
              ,CREATE_ID          
              ,CREATE_DATE        
              ,CREATE_IP          
              ,UPDATE_ID          
              ,UPDATE_DATE        
              ,UPDATE_IP          
              ,BOARD_HITS
              ,STAR
              ,DIG_CODE
              ,ORIGIN        
            ) VALUES(
              $12
              ,$1
              ,$2
              ,$3
              ,$4
              ,$5
              ,$6
              ,$7
              ,$8
              ,$9
              ,$10
              ,$5
              ,timezone('KST'::text, now())
              ,$11
              ,$5
              ,timezone('KST'::text, now())
              ,$11
              ,0
              ,$13
              ,$14
              ,$15
            )
            `
            ,[
              sm_menu_id
              ,board_category_code==null?'N':board_category_code
              ,board_title
              ,save(board_content)
              ,req.user==null?null:req.user.user_id
              ,req.user==null?nick_name:req.user.nick_name
              ,board_password!=null?crypto.createHash('sha512').update(board_password).digest('base64'):null
              ,req.user==null?'N':'Y'
              ,req.user==null?null:req.user.user_grade
              ,'Y'
              ,ip
              ,boardSeq
              ,star
              ,dig_code
              ,dig_code=='C'?null:origin
            ]
          ).then(function(err){
            db.query(
              `
              SELECT REGEXP_MATCHES ( BOARD_CONTENT, '[0-9]{13}.[A-Za-z]{3,4}','g') AS IMG_SRC 
                FROM BOARD
               WHERE SM_MENU_ID = $1
                 AND BOARD_SEQ  = $2
              `
              ,[sm_menu_id,boardSeq]
            ).then(
              async function(imgList){
                var imgSrc = ''
                 for(var i = 0 ; i < imgList.rows.length ; i ++){
                  imgSrc = imgList.rows[i].img_src;
                    await db.query(
                      `
                        UPDATE BOARD_IMG SET 
                        IMG_SEQ = $1
                        ,BOARD_SEQ = $2
                        WHERE SAVE_FILE_NAME = $3
                      `
                      ,[
                        i+1,
                        boardSeq,
                        imgSrc[0]
                      ]
                    )
                 }
                 res.redirect('/board/list?sm_menu_id='+req.param('sm_menu_id'))
              }
            )
          })
        }
      )
    }
  })
});

/** 자동로그인 */
router.all('/view', function(req,res,next){
  visitCount.visitLog(req,res,next);
  autoLogin.autoLogin(req,res,next);
}
)

/**
 * 게시판 글 상세보기 이동
 */
router.get('/view', async function(req, res, next) {
  await db.query(
    `
      UPDATE BOARD SET
      BOARD_HITS = (SELECT BOARD_HITS + 1 
                      FROM BOARD 
                     WHERE SM_MENU_ID = $1 
                       AND BOARD_SEQ = $2
                    )
      WHERE SM_MENU_ID = $1 
        AND BOARD_SEQ = $2 
    `
    ,
    [req.param('sm_menu_id'),req.param('board_seq')]
  )

  const wardYn  = await db.query(
    `
      SELECT CASE WHEN COUNT(*) > 0 THEN
             'Y'
             ELSE
             'N'
             END  as WARD_YN
        FROM WARD_BOARD 
       WHERE BOARD_SEQ  = $1
         AND SM_MENU_ID = $2
         AND USER_ID    = $3
    `
    ,[req.param('board_seq'),req.param('sm_menu_id'),req.user==null?null:req.user.user_id]
  )

  const star_yn  = await db.query(
    `
      SELECT STAR_YN
        FROM SM_MENU 
       WHERE SM_MENU_ID = $1
    `
    ,[req.param('sm_menu_id')]
  )

  const boardOne =await db.query(
    `
      SELECT A.BOARD_SEQ               AS BOARD_SEQ       
            ,A.BOARD_CATEGORY_CODE     AS BOARD_CATEGORY_CODE
            ,A.BOARD_TITLE             AS BOARD_TITLE
            ,A.BOARD_CONTENT           AS BOARD_CONTENT
            ,A.USER_ID                 AS USER_ID
            ,A.CREATE_IP               AS CREATE_IP
            ,A.NICK_NAME               AS NICK_NAME   
            ,A.PASSWORD                AS PASSWORD
            ,A.CREATE_DATE             AS CREATE_DATE
            ,A.SM_MENU_ID              AS SM_MENU_ID
            ,A.BOARD_HITS              AS BOARD_HITS
            ,A.USER_YN                 AS USER_YN
            ,A.USE_YN                  AS USE_YN
            ,A.STAR                    AS STAR
            ,(SELECT COUNT(*)     
                FROM BOARD_STATUS B
                WHERE B.BOARD_SEQ          = A.BOARD_SEQ
                  AND B.COMMENT_SEQ        IS NULL
                  AND B.BOARD_GBN          = 'G'
                  AND B.SM_MENU_ID         = A.SM_MENU_ID
              )                      AS GOOD_COUNT
            ,(SELECT COUNT(*) 
                FROM BOARD_STATUS B
                WHERE B.BOARD_SEQ          = A.BOARD_SEQ
                  AND B.COMMENT_SEQ        IS NULL
                  AND B.BOARD_GBN          = 'B'
                  AND B.SM_MENU_ID         = A.SM_MENU_ID
              )                      AS BAD_COUNT
            ,CASE
                  WHEN B.USER_GRADE = 'BRAHMAN'
                  THEN 'master.png'
                  WHEN B.USER_GRADE = 'KSHATRIYA'
                  THEN 'supernamed.png'
                  WHEN B.USER_GRADE = 'VAISHYA'
                  THEN 'named.png'
                  WHEN B.USER_GRADE = 'SHUDRA'
                  THEN 'user.png'
             END AS USER_IMG
             ,B.USER_PHOTO          AS USER_PHOTO
             ,A.DIG_CODE            AS DIG_CODE
             ,A.ORIGIN              AS ORIGIN
        FROM BOARD A LEFT OUTER JOIN
             ONEJUMIN_USER B
             ON A.USER_ID = B.USER_ID
      WHERE A.SM_MENU_ID = $1 
        AND A.BOARD_SEQ  = $2 
    `
    ,
    [req.param('sm_menu_id'),req.param('board_seq')]
  )
  if(boardOne.rows[0].use_yn == 'R'){
    res.render('./board/blind',{sm_menu_id     : req.param('sm_menu_id'),user_info   : req.user})
  }

  if(boardOne.rows[0].use_yn == 'N'){
    res.render('./board/error',{sm_menu_id     : req.param('sm_menu_id'),user_info   : req.user})
  }

  var recentList     = await side.recentList(req,res,next)
  var mainNoticeList = await side.mainNoticeList(req,res,next)

  boardList(req, res, next).then(
    function(rtnList){
      boardOne.rows[0].create_date = moment(boardOne.rows[0].create_date).format('YYYY-MM-DD HH:mm')
      boardOne.rows[0].create_ip = boardOne.rows[0].create_ip.split('.')[0]+'.'+boardOne.rows[0].create_ip.split('.')[1]+'.*.*'
      res.render('./board/view',{boardList      : rtnList.boardList
                                ,boardnotiList  : rtnList.boardnotiList
                                ,wardYn         : wardYn.rows[0].ward_yn
                                ,sm_menu_id     : req.param('sm_menu_id')
                                ,cnt            : rtnList.cnt
                                ,pg             : rtnList.pg
                                ,search         : rtnList.search
                                ,start          : rtnList.start
                                ,write_yn       : rtnList.write_yn
                                ,menu_gbn       : rtnList.menu_gbn
                                ,end            : rtnList.end
                                ,sort           : rtnList.sort
                                ,boardOne       : boardOne.rows
                                ,user_info      : req.user
                                ,recentList     : recentList.rows
                                ,mainNoticeList : mainNoticeList.rows
                                ,star_yn        : star_yn.rows[0].star_yn
                              }
      );
    }
  );
});


/**
 * 게시판 수정 페이지로 이동
 */
router.post('/modify', async function(req, res, next) {
  const ynlist = await db.query(
    `
      SELECT COALESCE(WRITE_YN,'Y') as WRITE_YN
            ,COALESCE(STAR_YN ,'N') as STAR_YN
        FROM SM_MENU
      WHERE SM_MENU_ID = $1
    `
  ,[req.param('sm_menu_id')]
  )
  if(ynlist.rows[0].write_yn == 'N' && !req.user){
    res.render('main/error',{user_info   : req.user})
  }
  if(ynlist.rows[0].write_yn == 'N' && (req.user.user_grade != 'BRAHMAN') ){
    res.render('main/error',{user_info   : req.user})
  }

    const categoryList = await db.query(
      `
        SELECT BOARD_CATEGORY_CODE AS BOARD_CATEGORY_CODE
              ,BOARD_CATEGORY_NAME AS BOARD_CATEGORY_NAME
          FROM CODE_MAPPING
        WHERE SM_MENU_ID = $1
          AND (
                USER_GRADE = 'ALL'
                OR USER_GRADE = $2
        )
      `
    ,[
      req.param('sm_menu_id')
      ,req.user==null?'':req.user.user_grade
    ]
    )

   const boardOne = await db.query(
    `
      SELECT SM_MENU_ID               AS SM_MENU_ID
             ,BOARD_SEQ               AS BOARD_SEQ
             ,BOARD_CATEGORY_CODE     AS BOARD_CATEGORY_CODE
             ,BOARD_TITLE             AS BOARD_TITLE
             ,BOARD_CONTENT           AS BOARD_CONTENT 
             ,STAR                    AS STAR 
             ,DIG_CODE                AS DIG_CODE
             ,ORIGIN                  AS ORIGIN
        FROM BOARD
       WHERE SM_MENU_ID = $1 
         AND BOARD_SEQ  = $2 
    `
    ,
    [req.param('sm_menu_id'),req.param('board_seq')]
  )

  res.render('./board/modify', { boardOne     : boardOne.rows
                                ,star_yn      : ynlist.rows[0].star_yn
                                ,user_info    : req.user
                                ,sm_menu_id   : req.param('sm_menu_id')
                                ,categoryList : categoryList.rows
                              }
                            );
});

/**
 * 게시판 수정전 비밀번호 체크
 */
router.post('/upt', function(req, res, next) {
  const { k_menuId,k_boardSeq,k_password } = req.body
  var  passwordOne = '';
  db.query(
   `
     SELECT PASSWORD AS PASSWORD 
       FROM BOARD
      WHERE SM_MENU_ID = $1 
        AND BOARD_SEQ  = $2 
   `
   ,[k_menuId,k_boardSeq]
 ).then(function(passRow){
    if(!req.user){
        passwordOne = passRow.rows[0].password;
        if( passwordOne == crypto.createHash('sha512').update(k_password).digest('base64')){
            res.send({sFlag:true})
        }else{
            res.send({sFlag:false})
        }
    }else{
        res.send({sFlag:true})
    }
  })
});

/**
 * 게시판 수정 처리
 */
router.post('/mod', function(req, res, next) {
  var ip = ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
  const{board_title,board_content,board_category_code,sm_menu_id,board_seq,star,dig_code,origin} = req.body
  db.query(
   `
    UPDATE BOARD SET
    BOARD_TITLE           = $1
    ,BOARD_CONTENT        = $2
    ,BOARD_CATEGORY_CODE  = $3
    ,UPDATE_ID            = $4
    ,UPDATE_DATE          = timezone('KST'::text, now())
    ,UPDATE_IP            = $5
    ,STAR                 = $8
    ,DIG_CODE             = $9
    ,ORIGIN               = $10
    WHERE SM_MENU_ID      = $6
      AND BOARD_SEQ       = $7 
   `
   ,
   [ board_title
    ,board_content
    ,board_category_code==null?'N':board_category_code
    ,req.user==null?null:req.user.user_id
    ,ip
    ,sm_menu_id
    ,board_seq
    ,star
    ,dig_code
    ,dig_code=='C'?null:origin
   ]
 ).then(function(err){
  db.query(
    `
    SELECT REGEXP_MATCHES ( BOARD_CONTENT, '[0-9]{13}.[A-Za-z]{3,4}','g') AS IMG_SRC 
      FROM BOARD
     WHERE SM_MENU_ID = $1
       AND BOARD_SEQ  = $2
    `
    ,[sm_menu_id,board_seq]
  ).then(
    async function(imgList){
      await db.query(
        `
          UPDATE BOARD_IMG SET 
          IMG_SEQ = null
          ,BOARD_SEQ = null
          WHERE BOARD_SEQ = $1
          AND SM_MENU_ID  = $2
        `
        ,[
          board_seq,
          sm_menu_id
        ]
      ).then(
        async function(){
          var imgSrc = ''
          for(var i = 0 ; i < imgList.rows.length ; i ++){
              imgSrc = imgList.rows[i].img_src;
                await db.query(
                  `
                    UPDATE BOARD_IMG SET 
                    IMG_SEQ = $1
                    ,BOARD_SEQ = $2
                    WHERE SAVE_FILE_NAME = $3
                  `
                  ,[
                    i+1,
                    board_seq,
                    imgSrc[0]
                  ]
                )
            }
            res.redirect('/board/view?sm_menu_id='+sm_menu_id+'&board_seq='+board_seq)
        }
      )
    }
  )
 })
});

/**
 * 게시판 글 삭제
 */
router.post('/del', function(req, res, next) {
  const { k_menuId,k_boardSeq,k_password } = req.body
  var  passwordOne = '';
  db.query(
   `
     SELECT PASSWORD AS PASSWORD 
       FROM BOARD
      WHERE SM_MENU_ID = $1 
        AND BOARD_SEQ  = $2 
   `
   ,[k_menuId,k_boardSeq]
 ).then(function(passRow){
      if(!req.user){
        passwordOne = passRow.rows[0].password;
        if( passwordOne == crypto.createHash('sha512').update(k_password).digest('base64')){
          boarDel(req,res,next).then(
            function(){
              res.send({sFlag:true})
            }
          );
        }else{
            res.send({sFlag:false})
        }
      }else{
        boarDel(req,res,next).then(
          function(){
            res.send({sFlag:true})
          }
        );
      }
  })
});


/**
 * 게시판 댓글 초기
 */
router.post('/comment_list', function(req, res, next) {
  commentList(req, res, next).then(
    function(commentList){
      for(var i = 0 ;  i < commentList.rtn_commentList.length ; i ++){
      commentList.rtn_commentList[i].create_ip = commentList.rtn_commentList[i].create_ip.split('.')[0] + "." + commentList.rtn_commentList[i].create_ip.split('.')[1] + ".*.*"
        if(moment(new Date()).format('YYYYMMDD') === moment(commentList.rtn_commentList[i].create_date).format('YYYYMMDD')){
          commentList.rtn_commentList[i].create_date = moment(commentList.rtn_commentList[i].create_date).fromNow();
        }else{
          commentList.rtn_commentList[i].create_date = moment(commentList.rtn_commentList[i].create_date).format('YYYY-MM-DD');
        }
      }

      for(var i = 0 ;  i < commentList.rtn_commentBestList.length ; i ++){
      commentList.rtn_commentBestList[i].create_ip = commentList.rtn_commentBestList[i].create_ip.split('.')[0] + "." + commentList.rtn_commentBestList[i].create_ip.split('.')[1] + ".*.*"
        if(moment(new Date()).format('YYYYMMDD') === moment(commentList.rtn_commentBestList[i].create_date).format('YYYYMMDD')){
          commentList.rtn_commentBestList[i].create_date = moment(commentList.rtn_commentBestList[i].create_date).fromNow();
        }else{
          commentList.rtn_commentBestList[i].create_date = moment(commentList.rtn_commentBestList[i].create_date).format('YYYY-MM-DD');
        }
      }

      res.send({commentList:commentList.rtn_commentList ,commentBestList:commentList.rtn_commentBestList})
    });
});

/**
 * 게시판 댓글 등록
 */
router.post('/comment_edit', function(req, res, next) {
  var ip =  ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
  var commentSeq = ''
  let { k_menuId,k_boardSeq,k_commentNickName,k_commnetPassword,k_recommentParentSeq,k_commentContent } = req.body
  db.query(
    `
    SELECT 
    (SELECT COUNT(*) AS CNT
      FROM BOARD_COMMENT
      WHERE CREATE_IP = $1
        AND TO_CHAR(timezone('KST'::text, now()),'YYYYMMDD') = TO_CHAR(CREATE_DATE,'YYYYMMDD')
     ) AS CNT
     ,
     ( SELECT COUNT(*)  AS CNT
        FROM USER_IP_BAN
        WHERE END_DATE > timezone('KST'::text, now())
          AND START_DATE < timezone('KST'::text, now())
          AND USER_IP  = $1
     ) AS BLOCK_CNT
     ,
     ( SELECT TO_CHAR(END_DATE,'YYYY-MM-DD HH24:MI:SS') 
        FROM USER_IP_BAN
        WHERE END_DATE > timezone('KST'::text, now())
          AND START_DATE < timezone('KST'::text, now())
          AND USER_IP  = $1
     ) AS END_DATE 
    `
    ,[ip]
  ).then(function(cntList){
    if( cntList.rows[0].block_cnt > 0 ){
      req.flash('errMsg','쓰기 정지된 대상입니다. 정지 해제 시간 '+ cntList.rows[0].end_date);
      res.send({errMsg:req.flash('errMsg')})
    }
    else if((cntList.rows[0].cnt > 10) && !req.user){
      req.flash('errMsg','비회원은 하루에 10개의 댓글을 작성할 수 있습니다.');
      res.send({errMsg:req.flash('errMsg')})
    }else{
        db.query(
          `
            SELECT COALESCE(MAX(COMMENT_SEQ),0) + 1 as comment_seq
              FROM BOARD_COMMENT 
            WHERE SM_MENU_ID = $1 
              AND BOARD_SEQ = $2
          `
          ,[
            k_menuId
           ,k_boardSeq
          ]
      ).then(
        function(comment_seq){
          commentSeq = comment_seq.rows[0].comment_seq
          db.query(
            `
              INSERT INTO BOARD_COMMENT(
               COMMENT_SEQ       
               ,BOARD_SEQ         
               ,SM_MENU_ID        
               ,USER_ID           
               ,NICK_NAME 
               ,PASSWORD        
               ,USER_YN           
               ,USER_GRADE        
               ,USE_YN            
               ,COMMENT_CONTENT   
               ,CREATE_ID         
               ,CREATE_DATE       
               ,CREATE_IP         
               ,UPDATE_ID         
               ,UPDATE_DATE       
               ,UPDATE_IP         
               ,PARENT_COMMENT_SEQ
              )
              VALUES(
               $11
               ,$2
               ,$1
               ,$3
               ,$4
               ,$7
               ,$9
               ,$10
               ,'Y'
               ,$5
               ,$3
               ,timezone('KST'::text, now())
               ,$6
               ,$3
               ,timezone('KST'::text, now())
               ,$6
               ,$8
              )
            `
            ,[
              k_menuId
             ,k_boardSeq
             ,req.user==null?null:req.user.user_id
             ,req.user==null?k_commentNickName:req.user.nick_name
             ,k_commentContent
             ,ip
             ,k_commnetPassword!=null?crypto.createHash('sha512').update(k_commnetPassword).digest('base64'):null
             ,k_recommentParentSeq
             ,req.user==null?'N':'Y'
             ,req.user==null?null:req.user.user_grade
             ,comment_seq.rows[0].comment_seq
           ]
          ).then( function(rtn){
             insertReact(req, res, next, commentSeq).then(
               function(){
                  /* view에 다시그릴 commentList */
                  commentList(req, res, next).then(
                    function(commentList){
                      for(var i = 0 ;  i < commentList.rtn_commentList.length ; i ++){
                      commentList.rtn_commentList[i].create_ip = commentList.rtn_commentList[i].create_ip.split('.')[0] + "." + commentList.rtn_commentList[i].create_ip.split('.')[1] + ".*.*"
                        if(moment(new Date()).format('YYYYMMDD') === moment(commentList.rtn_commentList[i].create_date).format('YYYYMMDD')){
                          commentList.rtn_commentList[i].create_date = moment(commentList.rtn_commentList[i].create_date).fromNow();
                        }else{
                          commentList.rtn_commentList[i].create_date = moment(commentList.rtn_commentList[i].create_date).format('YYYY-MM-DD');
                        }
                      }
        
                      for(var i = 0 ;  i < commentList.rtn_commentBestList.length ; i ++){
                      commentList.rtn_commentBestList[i].create_ip = commentList.rtn_commentBestList[i].create_ip.split('.')[0] + "." + commentList.rtn_commentBestList[i].create_ip.split('.')[1] + ".*.*"
                      if(moment(new Date()).format('YYYYMMDD') === moment(commentList.rtn_commentBestList[i].create_date).format('YYYYMMDD')){
                        commentList.rtn_commentBestList[i].create_date = moment(commentList.rtn_commentBestList[i].create_date).fromNow();
                      }else{
                        commentList.rtn_commentBestList[i].create_date = moment(commentList.rtn_commentBestList[i].create_date).format('YYYY-MM-DD');
                      }
                    }
                    res.send({commentList:commentList.rtn_commentList ,commentBestList:commentList.rtn_commentBestList})
                    });
                    /* view에 다시그릴 commentList 끝 */
               }
             )
          })
        }
      )
    }
  })
});

/**
 * 게시판 댓글 삭제
 */
router.post('/comment_del', function(req, res, next) {
  var ip = ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
  const {k_menuId,k_boardSeq,k_delCommentPassword,k_commentSeq} = req.body
  db.query(
    `
      SELECT PASSWORD AS PASSWORD 
        FROM BOARD_COMMENT
       WHERE SM_MENU_ID   = $1 
         AND BOARD_SEQ    = $2
         AND COMMENT_SEQ  = $3 
    `
    ,[k_menuId,k_boardSeq,k_commentSeq]
  ).then(function(passRow){
       if(!req.user){
         passwordOne = passRow.rows[0].password;
         if( passwordOne == crypto.createHash('sha512').update(k_delCommentPassword).digest('base64')){
           commentDel(req,res,next).then(
             function(){
              commentList(req, res, next).then(
                function(commentList){
                  for(var i = 0 ;  i < commentList.rtn_commentList.length ; i ++){
                    commentList.rtn_commentList[i].create_ip = commentList.rtn_commentList[i].create_ip.split('.')[0] + "." + commentList.rtn_commentList[i].create_ip.split('.')[1] + ".*.*"
                    if(moment(new Date()).format('YYYYMMDD') === moment(commentList.rtn_commentList[i].create_date).format('YYYYMMDD')){
                      commentList.rtn_commentList[i].create_date = moment(commentList.rtn_commentList[i].create_date).fromNow();
                    }else{
                      commentList.rtn_commentList[i].create_date = moment(commentList.rtn_commentList[i].create_date).format('YYYY-MM-DD');
                    }
                  }

                  for(var i = 0 ;  i < commentList.rtn_commentBestList.length ; i ++){
                    commentList.rtn_commentBestList[i].create_ip = commentList.rtn_commentBestList[i].create_ip.split('.')[0] + "." + commentList.rtn_commentBestList[i].create_ip.split('.')[1] + ".*.*"
                      if(moment(new Date()).format('YYYYMMDD') === moment(commentList.rtn_commentBestList[i].create_date).format('YYYYMMDD')){
                        commentList.rtn_commentBestList[i].create_date = moment(commentList.rtn_commentBestList[i].create_date).fromNow();
                      }else{
                        commentList.rtn_commentBestList[i].create_date = moment(commentList.rtn_commentBestList[i].create_date).format('YYYY-MM-DD');
                      }
                    }
              
                    res.send({commentList:commentList.rtn_commentList ,commentBestList:commentList.rtn_commentBestList,sFlag:true})
                });
             }
           );
         }else{
             res.send({sFlag:false})
         }
       }else{
        commentDel(req,res,next).then(
           function(){
              commentList(req, res, next).then(
                function(commentList){
                  for(var i = 0 ;  i < commentList.rtn_commentList.length ; i ++){
                    commentList.rtn_commentList[i].create_ip = commentList.rtn_commentList[i].create_ip.split('.')[0] + "." + commentList.rtn_commentList[i].create_ip.split('.')[1] + ".*.*"
                    if(moment(new Date()).format('YYYYMMDD') === moment(commentList.rtn_commentList[i].create_date).format('YYYYMMDD')){
                      commentList.rtn_commentList[i].create_date = moment(commentList.rtn_commentList[i].create_date).fromNow();
                    }else{
                      commentList.rtn_commentList[i].create_date = moment(commentList.rtn_commentList[i].create_date).format('YYYY-MM-DD');
                    }
                  }
                  
                  for(var i = 0 ;  i < commentList.rtn_commentBestList.length ; i ++){
                    commentList.rtn_commentBestList[i].create_ip = commentList.rtn_commentBestList[i].create_ip.split('.')[0] + "." + commentList.rtn_commentBestList[i].create_ip.split('.')[1] + ".*.*"
                      if(moment(new Date()).format('YYYYMMDD') === moment(commentList.rtn_commentBestList[i].create_date).format('YYYYMMDD')){
                        commentList.rtn_commentBestList[i].create_date = moment(commentList.rtn_commentBestList[i].create_date).fromNow();
                      }else{
                        commentList.rtn_commentBestList[i].create_date = moment(commentList.rtn_commentBestList[i].create_date).format('YYYY-MM-DD');
                      }
                    }
              
                    res.send({commentList:commentList.rtn_commentList ,commentBestList:commentList.rtn_commentBestList,sFlag:true})
              });
           }
         );
       }
   })
});

/**
 * 게시판 메인글 up and down
 */
router.post('/content_up_down', function(req, res, next) {
  const{k_menuId,k_boardSeq,k_upDown} = req.body;
  var ip =  ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
   /********************************** 로그인 영역  *********************************************/
  if(k_upDown != 'R'){
    if(req.user){
      db.query(
        `
          SELECT COUNT(*) DUB_CNT
            FROM BOARD_STATUS
          WHERE USER_ID    = $1
            AND SM_MENU_ID = $2
            AND BOARD_SEQ  = $3
            AND BOARD_GBN  != 'R'
            AND COMMENT_SEQ IS NULL
        `
        ,
        [ 
          req.user==null?null:req.user.user_id
          ,k_menuId
          ,k_boardSeq
        ]
      ).then(
        function(rtn){
          if(rtn.rows[0].dub_cnt > 0){
            res.send({msg:'ERR'});
          }else{
          /*****************************  추천한적없는 insert 시작 ******************************/   
              db.query(
                  `
                    INSERT INTO BOARD_STATUS
                    (
                      USER_ID           
                      ,USER_IP           
                      ,BOARD_GBN         
                      ,CREATE_IP         
                      ,CREATE_DATE       
                      ,SM_MENU_ID        
                      ,BOARD_SEQ         
                      ,COMMENT_SEQ       
                    ) VALUES(
                      $1
                      ,$2
                      ,$3
                      ,$4
                      ,timezone('KST'::text, now())
                      ,$5
                      ,$6
                      ,$7
                    )
                  `
                  ,
                  [ 
                    req.user==null?null:req.user.user_id
                    ,null
                    ,k_upDown
                    ,ip
                    ,k_menuId
                    ,k_boardSeq
                    ,null
                  ]
                ).then(
                  function(){
                    upDonwCnt(req, res, next).then(
                      function(upDonwCntList){
                          res.send({upDonwCntList:upDonwCntList.rtn_upDonwCntList,msg:'OK'});
                      }
                    )
                  }
                )
          /***************************** 여기까지 추천한적없는 insert ******************************/     
          }
        }
      )
    /**********************************    로그인 영역 끝  *********************************************/
    }else{
      /********************************** 비로그인 영역  *********************************************/
      db.query(
        `
          SELECT COUNT(*) DUB_CNT
            FROM BOARD_STATUS
          WHERE USER_IP    = $1
            AND SM_MENU_ID = $2
            AND BOARD_SEQ  = $3
            AND BOARD_GBN  != 'R'
            AND COMMENT_SEQ IS NULL
        `
        ,
        [ 
          ip
          ,k_menuId
          ,k_boardSeq
        ]
      ).then(
        function(rtn){
          if(rtn.rows[0].dub_cnt > 0){
            res.send({msg:'ERR'});
          }else{
          /*****************************  추천한적없는 insert 시작 ******************************/   
              db.query(
                  `
                    INSERT INTO BOARD_STATUS
                    (
                      USER_ID           
                      ,USER_IP           
                      ,BOARD_GBN         
                      ,CREATE_IP         
                      ,CREATE_DATE       
                      ,SM_MENU_ID        
                      ,BOARD_SEQ         
                      ,COMMENT_SEQ       
                    ) VALUES(
                      $1
                      ,$2
                      ,$3
                      ,$4
                      ,timezone('KST'::text, now())
                      ,$5
                      ,$6
                      ,$7
                    )
                  `
                  ,
                  [ 
                    null
                    ,ip
                    ,k_upDown
                    ,ip
                    ,k_menuId
                    ,k_boardSeq
                    ,null
                  ]
                ).then(
                  function(){
                    upDonwCnt(req, res, next).then(
                      function(upDonwCntList){
                          res.send({upDonwCntList:upDonwCntList.rtn_upDonwCntList,msg:'OK'});
                      }
                    )
                  }
                )
          /***************************** 여기까지 추천한적없는 insert ******************************/     
          }
        }
      )
    }
    /********************************** 비로그인 영역끝  *********************************************/
  }else{
    if(req.user){
      db.query(
        `
          SELECT COUNT(*) DUB_CNT
            FROM BOARD_STATUS
          WHERE USER_ID    = $1
            AND SM_MENU_ID = $2
            AND BOARD_SEQ  = $3
            AND BOARD_GBN  = 'R'
            AND COMMENT_SEQ IS NULL
        `
        ,
        [ 
          req.user==null?null:req.user.user_id
          ,k_menuId
          ,k_boardSeq
        ]
      ).then(
        function(rtn){
          if(rtn.rows[0].dub_cnt > 0){
            res.send({msg:'ERR'});
          }else{
          /*****************************  추천한적없는 insert 시작 ******************************/   
              db.query(
                  `
                    INSERT INTO BOARD_STATUS
                    (
                      USER_ID           
                      ,USER_IP           
                      ,BOARD_GBN         
                      ,CREATE_IP         
                      ,CREATE_DATE       
                      ,SM_MENU_ID        
                      ,BOARD_SEQ         
                      ,COMMENT_SEQ       
                    ) VALUES(
                      $1
                      ,$2
                      ,$3
                      ,$4
                      ,timezone('KST'::text, now())
                      ,$5
                      ,$6
                      ,$7
                    )
                  `
                  ,
                  [ 
                    req.user==null?null:req.user.user_id
                    ,null
                    ,k_upDown
                    ,ip
                    ,k_menuId
                    ,k_boardSeq
                    ,null
                  ]
                ).then(
                  function(){
                    upDonwCnt(req, res, next).then(
                      function(upDonwCntList){
                          res.send({upDonwCntList:upDonwCntList.rtn_upDonwCntList,msg:'OK'});
                      }
                    )
                  }
                )
          /***************************** 여기까지 추천한적없는 insert ******************************/     
          }
        }
      )
    /**********************************    로그인 영역 끝  *********************************************/
    }
  }
});

/**
 * 게시판 댓글 up and down
 */
router.post('/comment_up_down', function(req, res, next) {
  const{k_menuId,k_boardSeq,k_upDown,k_commentSeq} = req.body;
  var ip =  ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
   /********************************** 로그인 영역  *********************************************/
  if(k_upDown != 'R'){
    if(req.user){
      db.query(
        `
          SELECT COUNT(*) DUB_CNT
            FROM BOARD_STATUS
          WHERE USER_ID      = $1
            AND SM_MENU_ID   = $2
            AND BOARD_SEQ    = $3
            AND COMMENT_SEQ  = $4
            AND BOARD_GBN    != 'R'
        `
        ,
        [ 
          req.user==null?null:req.user.user_id
          ,k_menuId
          ,k_boardSeq
          ,k_commentSeq
        ]
      ).then(
        function(rtn){
          if(rtn.rows[0].dub_cnt > 0){
            res.send({msg:'ERR'});
          }else{
          /*****************************  추천한적없는 insert 시작 ******************************/   
              db.query(
                  `
                    INSERT INTO BOARD_STATUS
                    (
                      USER_ID           
                      ,USER_IP           
                      ,BOARD_GBN         
                      ,CREATE_IP         
                      ,CREATE_DATE       
                      ,SM_MENU_ID        
                      ,BOARD_SEQ         
                      ,COMMENT_SEQ       
                    ) VALUES(
                      $1
                      ,$2
                      ,$3
                      ,$4
                      ,timezone('KST'::text, now())
                      ,$5
                      ,$6
                      ,$7
                    )
                  `
                  ,
                  [ 
                    req.user==null?null:req.user.user_id
                    ,null
                    ,k_upDown
                    ,ip
                    ,k_menuId
                    ,k_boardSeq
                    ,k_commentSeq
                  ]
                ).then(
                  function(){
                    commentList(req, res, next).then(
                      function(commentList){
                        for(var i = 0 ;  i < commentList.rtn_commentList.length ; i ++){
                          commentList.rtn_commentList[i].create_ip = commentList.rtn_commentList[i].create_ip.split('.')[0] + "." + commentList.rtn_commentList[i].create_ip.split('.')[1] + ".*.*"
                          if(moment(new Date()).format('YYYYMMDD') === moment(commentList.rtn_commentList[i].create_date).format('YYYYMMDD')){
                            commentList.rtn_commentList[i].create_date = moment(commentList.rtn_commentList[i].create_date).fromNow();
                          }else{
                            commentList.rtn_commentList[i].create_date = moment(commentList.rtn_commentList[i].create_date).format('YYYY-MM-DD');
                          }
                        }
                        for(var i = 0 ;  i < commentList.rtn_commentBestList.length ; i ++){
                          commentList.rtn_commentBestList[i].create_ip = commentList.rtn_commentBestList[i].create_ip.split('.')[0] + "." + commentList.rtn_commentBestList[i].create_ip.split('.')[1] + ".*.*"
                            if(moment(new Date()).format('YYYYMMDD') === moment(commentList.rtn_commentBestList[i].create_date).format('YYYYMMDD')){
                              commentList.rtn_commentBestList[i].create_date = moment(commentList.rtn_commentBestList[i].create_date).fromNow();
                            }else{
                              commentList.rtn_commentBestList[i].create_date = moment(commentList.rtn_commentBestList[i].create_date).format('YYYY-MM-DD');
                            }
                          }
                    
                          res.send({commentList:commentList.rtn_commentList ,commentBestList:commentList.rtn_commentBestList,sFlag:true})
                    });
                  }
                )
          /***************************** 여기까지 추천한적없는 insert ******************************/     
          }
        }
      )
    /**********************************    로그인 영역 끝  *********************************************/
    }else{
      /********************************** 비로그인 영역  *********************************************/
      db.query(
        `
          SELECT COUNT(*) DUB_CNT
            FROM BOARD_STATUS
          WHERE USER_IP      = $1
            AND SM_MENU_ID   = $2
            AND BOARD_SEQ    = $3
            AND COMMENT_SEQ  = $4
            AND BOARD_GBN    != 'R'
        `
        ,
        [ 
          ip
          ,k_menuId
          ,k_boardSeq
          ,k_commentSeq
        ]
      ).then(
        function(rtn){
          if(rtn.rows[0].dub_cnt > 0){
            res.send({msg:'ERR'});
          }else{
          /*****************************  추천한적없는 insert 시작 ******************************/   
              db.query(
                  `
                    INSERT INTO BOARD_STATUS
                    (
                      USER_ID           
                      ,USER_IP           
                      ,BOARD_GBN         
                      ,CREATE_IP         
                      ,CREATE_DATE       
                      ,SM_MENU_ID        
                      ,BOARD_SEQ         
                      ,COMMENT_SEQ       
                    ) VALUES(
                      $1
                      ,$2
                      ,$3
                      ,$4
                      ,timezone('KST'::text, now())
                      ,$5
                      ,$6
                      ,$7
                    )
                  `
                  ,
                  [ 
                    null
                    ,ip
                    ,k_upDown
                    ,ip
                    ,k_menuId
                    ,k_boardSeq
                    ,k_commentSeq
                  ]
                ).then(
                  function(){
                    commentList(req, res, next).then(
                      function(commentList){
                        for(var i = 0 ;  i < commentList.rtn_commentList.length ; i ++){
                          commentList.rtn_commentList[i].create_ip = commentList.rtn_commentList[i].create_ip.split('.')[0] + "." + commentList.rtn_commentList[i].create_ip.split('.')[1] + ".*.*"
                          if(moment(new Date()).format('YYYYMMDD') === moment(commentList.rtn_commentList[i].create_date).format('YYYYMMDD')){
                            commentList.rtn_commentList[i].create_date = moment(commentList.rtn_commentList[i].create_date).fromNow();
                          }else{
                            commentList.rtn_commentList[i].create_date = moment(commentList.rtn_commentList[i].create_date).format('YYYY-MM-DD');
                          }
                        }
                        for(var i = 0 ;  i < commentList.rtn_commentBestList.length ; i ++){
                        commentList.rtn_commentBestList[i].create_ip = commentList.rtn_commentBestList[i].create_ip.split('.')[0] + "." + commentList.rtn_commentBestList[i].create_ip.split('.')[1] + ".*.*"
                          if(moment(new Date()).format('YYYYMMDD') === moment(commentList.rtn_commentBestList[i].create_date).format('YYYYMMDD')){
                            commentList.rtn_commentBestList[i].create_date = moment(commentList.rtn_commentBestList[i].create_date).fromNow();
                          }else{
                            commentList.rtn_commentBestList[i].create_date = moment(commentList.rtn_commentBestList[i].create_date).format('YYYY-MM-DD');
                          }
                        }
                  
                        res.send({commentList:commentList.rtn_commentList ,commentBestList:commentList.rtn_commentBestList,sFlag:true})
                    });
                  }
                )
          /***************************** 여기까지 추천한적없는 insert ******************************/     
          }
        }
      )
    }
  }else{ //신고 영역
    if(req.user){
      db.query(
        `
          SELECT COUNT(*) DUB_CNT
            FROM BOARD_STATUS
          WHERE USER_ID      = $1
            AND SM_MENU_ID   = $2
            AND BOARD_SEQ    = $3
            AND COMMENT_SEQ  = $4
            AND BOARD_GBN    = 'R'
        `
        ,
        [ 
          req.user==null?null:req.user.user_id
          ,k_menuId
          ,k_boardSeq
          ,k_commentSeq
        ]
      ).then(
        function(rtn){
          if(rtn.rows[0].dub_cnt > 0){
            res.send({msg:'ERR'});
          }else{
          /*****************************  신고한적없는 insert 시작 ******************************/   
              db.query(
                  `
                    INSERT INTO BOARD_STATUS
                    (
                      USER_ID           
                      ,USER_IP           
                      ,BOARD_GBN         
                      ,CREATE_IP         
                      ,CREATE_DATE       
                      ,SM_MENU_ID        
                      ,BOARD_SEQ         
                      ,COMMENT_SEQ       
                    ) VALUES(
                      $1
                      ,$2
                      ,$3
                      ,$4
                      ,timezone('KST'::text, now())
                      ,$5
                      ,$6
                      ,$7
                    )
                  `
                  ,
                  [ 
                    req.user==null?null:req.user.user_id
                    ,null
                    ,k_upDown
                    ,ip
                    ,k_menuId
                    ,k_boardSeq
                    ,k_commentSeq
                  ]
                ).then(
                  function(){
                    commentList(req, res, next).then(
                      function(commentList){
                        for(var i = 0 ;  i < commentList.rtn_commentList.length ; i ++){
                          commentList.rtn_commentList[i].create_ip = commentList.rtn_commentList[i].create_ip.split('.')[0] + "." + commentList.rtn_commentList[i].create_ip.split('.')[1] + ".*.*"
                          if(moment(new Date()).format('YYYYMMDD') === moment(commentList.rtn_commentList[i].create_date).format('YYYYMMDD')){
                            commentList.rtn_commentList[i].create_date = moment(commentList.rtn_commentList[i].create_date).fromNow();
                          }else{
                            commentList.rtn_commentList[i].create_date = moment(commentList.rtn_commentList[i].create_date).format('YYYY-MM-DD');
                          }
                        }

                        for(var i = 0 ;  i < commentList.rtn_commentBestList.length ; i ++){
                          commentList.rtn_commentBestList[i].create_ip = commentList.rtn_commentBestList[i].create_ip.split('.')[0] + "." + commentList.rtn_commentBestList[i].create_ip.split('.')[1] + ".*.*"
                            if(moment(new Date()).format('YYYYMMDD') === moment(commentList.rtn_commentBestList[i].create_date).format('YYYYMMDD')){
                              commentList.rtn_commentBestList[i].create_date = moment(commentList.rtn_commentBestList[i].create_date).fromNow();
                            }else{
                              commentList.rtn_commentBestList[i].create_date = moment(commentList.rtn_commentBestList[i].create_date).format('YYYY-MM-DD');
                            }
                          }
                    
                        res.send({commentList:commentList.rtn_commentList ,commentBestList:commentList.rtn_commentBestList,sFlag:true})
                    });
                  }
                )
          /***************************** 여기까지 신고한적없는 insert ******************************/     
          }
        }
      )
    /**********************************    로그인 영역 끝  *********************************************/
    }
  }
});

/**
 * 이미지 콜백 향후 변경
 */
router.post('/up_img', /*upload.single('file'),*/ function(req, res){
  upload(req, res, function (err) {
    if(err){
      res.send({url:null});
    }else{
        let sm_menu_id   = req.param('sm_menu_id');
        let originalname = req.file.originalname;
        let filename     = req.file.filename;
        //let imgPath      = '\\'+req.file.path.split('\\')[1]+'\\'+req.file.path.split('\\')[2];
        let imgPath      = '/'+req.file.path.split('/')[1]+'/'+req.file.path.split('/')[2];
        let imgSize      = req.file.size
        var ip           =  ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
        db.query(
          `
            INSERT INTO BOARD_IMG(
              SM_MENU_ID
              ,FILE_NAME     
              ,SAVE_FILE_NAME
              ,IMG_PATH      
              ,IMG_SIZE      
              ,CREATE_DATE   
              ,CREATE_IP     
              ,CREATE_ID     
            ) VALUES(
              $1
              ,$2
              ,$3
              ,$4
              ,$5
              ,timezone('KST'::text, now())
              ,$6
              ,$7
            )
          `
          ,[
            sm_menu_id
            ,originalname
            ,filename
            ,imgPath
            ,imgSize
            ,ip
            ,req.user==null?null:req.user.user_id]
        ).then(
          function(){
            //res.send({url:('\\'+req.file.path.split('\\')[1]+'\\'+req.file.path.split('\\')[2])});
            res.send({url:('/'+req.file.path.split('/')[1]+'/'+req.file.path.split('/')[2])});
          }
        )
    }
  })
});

/**
 * 게시판 소개글
 */
router.post('/breadcrumb', async function(req, res){
    const menuOne = await db.query(
      `
        SELECT A.SM_MENU_SUBCRIPT
              ,A.SM_MENU_NAME
              ,B.MENU_NAME
          FROM SM_MENU A
               , MENU_MASTER B
        WHERE A.MENU_ID = B.MENU_ID
          AND A.SM_MENU_ID = $1
      `
      ,[req.param('k_menuId')]
    )

    res.send({menuOne:menuOne.rows})
 });


 /**
 * 이미지삭제
 */
router.post('/del_img', function(req, res){
    const{k_filePath} = req.body
    let filePath = '/'+k_filePath.split('/')[3]+'/'+ k_filePath.split('/')[4];
    fs.exists('public'+filePath, function (exists) { 
        if(exists){
          fs.unlink('public'+filePath, function (err) { 
            console.log(filePath+'삭제')
          });
        }
    });
    res.send({msg:"파일삭제"});
});

 /**
 * 와딩
 */
router.post('/warding', function(req, res){
  const{k_menuId,k_boardSeq} = req.body
  if(!req.user){
    res.send({rtnMsg:'회원만 가능합니다.'})
  }else{
    db.query(
      `
        SELECT COUNT(*) CNT
          FROM WARD_BOARD
        WHERE SM_MENU_ID = $1
          AND BOARD_SEQ  = $2
          AND USER_ID    = $3
      `
      ,[k_menuId,k_boardSeq,req.user.user_id]
    ).then(
      function(cntList){
        if(cntList.rows[0].cnt*1 > 0 ){
          db.query(
            `
              DELETE FROM WARD_BOARD
              WHERE SM_MENU_ID = $1
              AND BOARD_SEQ  = $2
              AND USER_ID    = $3
            `
            ,[k_menuId,k_boardSeq,req.user.user_id]
          ).then(
            function(){
              res.send({rtnFlg:'del'})
            }
          )
        }else{
          db.query(
            `
              INSERT INTO WARD_BOARD
              (
                USER_ID 
                ,SM_MENU_ID  
                ,BOARD_SEQ 
                ,CREATE_DATE
              )VALUES(
                $1
                ,$2
                ,$3
                ,timezone('KST'::text, now())
              )
            `
            ,[req.user.user_id,k_menuId,k_boardSeq]
          ).then(
            function(){
              res.send({rtnFlg:'ins'})
            }
          )
        }
      }
    )
  }
});

module.exports = router;
