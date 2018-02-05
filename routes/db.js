const {Pool} = require('pg');

//asd

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
