
const sections=[
  ['Genel Bakış','Sistem sürümü, proje durumu ve çalışma bilgileri.'],
  ['Kullanıcılar','Kullanıcı hesapları, aktif/pasif durumu ve erişim yönetimi.'],
  ['Roller ve Yetkiler','Admin ve operatör yetkilerinin yönetimi.'],
  ['Kullanıcı Ayarları','Kullanıcıya özel malzeme, aralık, rotasyon ve özellik izinleri.'],
  ['Sistem Varsayılanları','Yeni kullanıcı ve projelerde kullanılacak varsayılanlar.'],
  ['Geçmiş ve Loglar','Yerleştirme geçmişi, dışa aktarma ve sistem olayları.'],
];
export default function Admin(){
  return <div className="admin-page"><header><a href={import.meta.env.BASE_URL}>← Çalışma alanı</a><h1>Serula Yönetim</h1></header>
    <main><aside>{sections.map(([name])=><a key={name} href={'#'+name.toLowerCase().replaceAll(' ','-')}>{name}</a>)}</aside>
    <section className="admin-content">{sections.map(([name,desc])=><article id={name.toLowerCase().replaceAll(' ','-')} key={name}><h2>{name}</h2><p>{desc}</p>{name==='Genel Bakış'&&<dl><dt>Durum</dt><dd>İstemci hazır</dd></dl>}{name!=='Genel Bakış'&&<p className="muted">Bu bölüm güvenli sunucu kimlik doğrulaması ve kalıcı kullanıcı veritabanına bağlandığında yönetilebilir olacaktır. İstemci tarafında sahte yetki oluşturulmaz.</p>}</article>)}</section></main></div>;
}
