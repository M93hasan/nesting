/** D1 project persistence adapter. No schema or SQL changes. */
export async function saveCloudProjectRecord(env,userId,projectName,encoded) {
    const statements=[
      env.DB.prepare('DELETE FROM cloud_project_chunks WHERE user_id=?').bind(userId),
      env.DB.prepare(`INSERT INTO cloud_projects(user_id,label,project_name,byte_size,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET label=excluded.label,project_name=excluded.project_name,byte_size=excluded.byte_size,updated_at=CURRENT_TIMESTAMP`)
        .bind(userId,'Serula Nesting En Temiz Hali',projectName,encoded.byteSize),
      ...encoded.chunks.map((chunk,index)=>env.DB.prepare('INSERT INTO cloud_project_chunks(user_id,chunk_index,data) VALUES(?,?,?)').bind(userId,index,chunk))
    ];
  await env.DB.batch(statements);
}
export async function findCloudProjectRecord(env,userId) {
  return env.DB.prepare('SELECT label,project_name,byte_size,updated_at FROM cloud_projects WHERE user_id=?').bind(userId).first();
}
