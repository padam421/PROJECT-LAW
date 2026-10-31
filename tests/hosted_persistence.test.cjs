/* Runs against a disposable MySQL service in CI. No developer DB is touched by default. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
test('hosted accounts, lockouts, uploads and AI history survive a fresh Node process', {
  skip: process.env.CI_MYSQL_TEST !== 'true', timeout: 60000
}, () => {
  const root = path.resolve(__dirname, '..');
  const common = `
    const assert=require('node:assert/strict');
    const db=require('./backend/src/config/dbConfig');
    const files=require('./backend/src/services/hostedStore');
    const repo=require('./backend/src/services/assistantRepository');
    const sql=require('./backend/src/services/dbService');
  `;
  const first = `
    await db.initialize();
    assert.equal(db.get().users.length,0);
    const user={id:'hosted_qa',role:'user',email:'qa@example.invalid',passwordHash:'synthetic',accountStatus:'active',isVerified:true};
    db.get().users.push(user);
    db.get().loginActivity.push({id:'attempt',userId:user.id,type:'login_failed'});
    db.get().sessions.push({id:'session_qa',userId:user.id,revoked:true});
    db.get().workspace[user.id]={settings:{language:'hi'}};
    db.save(); await db.flushDurable();
    await sql.createUser(user);
    assert.equal((await sql.getMySQLPool().query('SELECT id FROM users WHERE id=?',[user.id]))[0].length,1);
    const auth=require('./backend/src/services/authService');
    const googleLogin=await auth.loginGoogle({sub:'hosted-google-sub',email:user.email,email_verified:true,hd:'example.invalid'},'lawyer',
      {headers:{},get:()=>'',ip:'127.0.0.1'});
    assert.equal(googleLogin.ok,true);
    assert.equal(googleLogin.user.id,user.id);
    assert.equal(googleLogin.user.role,'user');
    const linked=(await sql.getMySQLPool().query('SELECT is_google_auth,password_hash FROM users WHERE id=?',[user.id]))[0][0];
    assert.equal(linked.is_google_auth,1);
    assert.equal(linked.password_hash,'synthetic');
    await db.flushDurable();
    const bytes=Buffer.alloc(1100000,7);await files.saveFile('credential_qa.pdf',bytes);
    assert.deepEqual(await files.readFile('credential_qa.pdf'),bytes);
    const saved=await repo.put(user.id,{id:'chat_qa',title:'Saved case',messages:[],courtSessions:{}},0);
    assert.equal(saved.revision,1);
    await assert.rejects(repo.put(user.id,{id:'chat_qa',title:'Stale'},0),{status:409});
    assert.deepEqual(await repo.list('other_account'),[]);
    await sql.getMySQLPool().query('INSERT INTO notifications(id,user_id,type,message) VALUES(?,?,?,?),(?,?,?,?)',
      ['notification_own_qa',user.id,'lawyer','Own update','notification_other_qa','other_account','lawyer','Private update']);
    const notifications=await sql.getUserNotifications(user.id,'lawyer');
    assert.equal(notifications.length,1);
    assert.equal(notifications[0].id,'notification_own_qa');
    assert.equal(await sql.markNotificationRead('notification_other_qa',user.id),false);
    assert.equal((await sql.getMySQLPool().query('SELECT is_read FROM notifications WHERE id=?',['notification_other_qa']))[0][0].is_read,0);
    assert.equal(await sql.markNotificationRead('notification_own_qa',user.id),true);
  `;
  const second = `
    await db.initialize();
    assert.equal(db.get().users[0].id,'hosted_qa');
    assert.equal(db.get().sessions[0].revoked,true);
    assert.ok(db.get().loginActivity.some(entry=>entry.type==='login_failed'));
    assert.equal(db.get().users[0].googleSubject,'hosted-google-sub');
    assert.equal((await sql.findUserByEmail('qa@example.invalid')).isGoogleAuth,true);
    const repeat=await require('./backend/src/services/authService').loginGoogle(
      {sub:'hosted-google-sub',email:'qa@example.invalid',email_verified:true,hd:'example.invalid'},'user',
      {headers:{},get:()=>'',ip:'127.0.0.1'});
    assert.equal(repeat.ok,true);
    assert.equal(repeat.user.id,'hosted_qa');
    assert.equal(db.get().workspace.hosted_qa.settings.language,'hi');
    assert.equal((await files.readFile('credential_qa.pdf')).length,1100000);
    assert.equal((await repo.list('hosted_qa'))[0].title,'Saved case');
    await files.deleteFile('credential_qa.pdf');
    assert.equal(await files.readFile('credential_qa.pdf'),null);
  `;
  for (const phase of [first, second]) {
    const child = spawnSync(process.execPath, ['-e', common + `(async()=>{try{${phase}}finally{await files.close();}})().catch(e=>{console.error(e);process.exitCode=1;});`], {
      cwd: root, encoding: 'utf8', timeout: 25000,
      env: { ...process.env, NODE_ENV: 'development', STATE_STORE: 'mysql', DB_SSL: 'false',
        DATA_DIR: path.join(root,'.tmp-test','hosted-qa-'+process.pid), UPLOADS_DIR:path.join(root,'.tmp-test','hosted-qa-'+process.pid,'uploads') }
    });
    assert.equal(child.status, 0, child.stdout + child.stderr);
  }
});
