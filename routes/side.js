var express           = require('express');
var db                = require('./db');
var crypto            = require('crypto'); 
var moment            = require('moment'); //시간

module.exports = {
    recentList : async function (req,res,next) {
        var recentList = await db.query(
                `
                    SELECT A.BOARD_TITLE
                    ,A.BOARD_HITS
                    ,D.SM_MENU_NAME
                    ,D.SM_MENU_ABB
                    ,A.BOARD_SEQ 
                    ,A.SM_MENU_ID
                    ,A.CREATE_DATE
                    ,(
                      SELECT COUNT(*)
                        FROM BOARD_COMMENT B
                       WHERE B.BOARD_SEQ  = A.BOARD_SEQ
                         AND B.SM_MENU_ID = A.SM_MENU_ID
                         AND B.USE_YN     != 'N'
                    ) AS COMMENT_CNT
                    ,CASE WHEN A.BOARD_CONTENT LIKE '%<img src%' THEN
                      'Y'
                    ELSE
                      'N'
                    END AS PHOTO_YN
                    ,CASE WHEN A.BOARD_CONTENT LIKE '%<iframe%' THEN
                      'Y'
                    ELSE
                      'N'
                    END AS VIDEO_YN
                FROM BOARD A
                    ,SM_MENU D
              WHERE A.SM_MENU_ID          = D.SM_MENU_ID
              AND A.BOARD_CATEGORY_CODE != 'G'
              AND A.USE_YN              = 'Y'
              AND D.INDEX_YN            = 'Y'
              ORDER BY A.CREATE_DATE DESC
              LIMIT 10 OFFSET 0
                `
            )

            for(var j = 0 ;  j < recentList.rows.length ; j ++){
                if(moment(new Date()).format('YYYYMMDD') === moment(recentList.rows[j].create_date).format('YYYYMMDD')){
                    recentList.rows[j].create_date = moment(recentList.rows[j].create_date).fromNow();
                }else{
                    recentList.rows[j].create_date = moment(recentList.rows[j].create_date).format('MM.DD');
                }
            }
            return recentList;
        }
    ,mainNoticeList : async function (req,res,next) {
        var mainNoticeList = await db.query(
                `
                    SELECT A.BOARD_TITLE
                    ,A.BOARD_HITS
                    ,D.SM_MENU_NAME
                    ,D.SM_MENU_ABB
                    ,A.BOARD_SEQ 
                    ,A.SM_MENU_ID
                    ,A.CREATE_DATE
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
                FROM BOARD A
                    ,SM_MENU D
              WHERE A.SM_MENU_ID        = D.SM_MENU_ID
              AND A.USE_YN              = 'Y'
              AND A.SM_MENU_ID          = 'M0103'
              ORDER BY A.CREATE_DATE DESC
              LIMIT 5 OFFSET 0
                `
            )

            for(var j = 0 ;  j < mainNoticeList.rows.length ; j ++){
                if(moment(new Date()).format('YYYYMMDD') === moment(mainNoticeList.rows[j].create_date).format('YYYYMMDD')){
                    mainNoticeList.rows[j].create_date = moment(mainNoticeList.rows[j].create_date).fromNow();
                }else{
                    mainNoticeList.rows[j].create_date = moment(mainNoticeList.rows[j].create_date).format('MM.DD');
                }
            }
            return mainNoticeList;
        }
};
