import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';

const worker=readFileSync(new URL('../worker/serula-worker.js',import.meta.url),'utf8');
const admin=readFileSync(new URL('../src/Admin.tsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const authCss=readFileSync(new URL('../src/auth.css',import.meta.url),'utf8');

test('persistent live support schema and APIs stay wired',()=>{
  expect(worker).toContain('CREATE TABLE IF NOT EXISTS chat_messages');
  expect(worker).toContain('CREATE TABLE IF NOT EXISTS user_presence');
  expect(worker).toContain("path==='/api/chat'");
  expect(worker).toContain("path==='/api/admin/chats'");
  expect(worker).toContain("request.method==='DELETE'");
  expect(worker).toContain("DELETE FROM users WHERE id=?");
});

test('contact and admin support UIs remain connected',()=>{
  expect(app).toContain("import SupportChat from './components/SupportChat'");
  expect(app).toContain('<SupportChat/>');
  expect(admin).toContain("label:'Canlı Destek'");
  expect(admin).toContain('Çevrim içi');
  expect(admin).toContain('Kullanıcıyı sil');
  expect(admin).toContain('admin-presence-dot');
});

test('profile control remains visible and mobile friendly',()=>{
  expect(authCss).toContain('.auth-account-menu>summary');
  expect(authCss).toContain('.auth-account-name{display:block');
  expect(authCss).toContain('width:min(280px,calc(100vw - 24px))');
});
