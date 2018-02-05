const {Pool} = require('pg');

/* DB 정보 */ 
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database:'postgres',
    password:'sksmssk',
    port: 5432 ,
    max: 20
});

// const pool = new Pool({
//   user: 'saecomaster',
//   host: 'onejumin.ciojezwttlpc.ap-northeast-2.rds.amazonaws.com',
//   database:'postgres',
//   password:'sksmssk12!',
//   port: 5432 ,
// });

module.exports = {
  query: async function(text, params, callback)  {
    console.log(text);
    console.log(params);
    let result = '';
      const client = await pool.connect();
      try{
        result = await client.query(text, params)
      }finally{
        client.release();
        return result;
      }
  }
}
