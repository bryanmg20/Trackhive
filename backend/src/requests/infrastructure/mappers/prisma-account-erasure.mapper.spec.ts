import { PrismaAccountErasureMapper } from './prisma-account-erasure.mapper';
describe('notification comment redaction', () => {
  it('preserves citizen data and replaces only the staff slots including HTML escaping', () => {
    const comment = 'Ana <&>\nprivado';
    const row = {
      body: `Hola, Ana:\n\nObservaciones del personal:\n${comment}\n\nMaterial solicitado:\n- Ana`,
      htmlBody:
        '<p>Hola, Ana:</p><p style="margin:0;color:#1e293b;">Ana &lt;&amp;&gt;<br>privado</p><p>Material Ana</p>',
    };
    const result = PrismaAccountErasureMapper.notification(row, comment);
    expect(result.body).toBe(
      'Hola, Ana:\n\nObservaciones del personal:\n[Comentario del personal suprimido]\n\nMaterial solicitado:\n- Ana',
    );
    expect(result.htmlBody).toBe(
      '<p>Hola, Ana:</p><p style="margin:0;color:#1e293b;">[Comentario del personal suprimido]</p><p>Material Ana</p>',
    );
    expect(Object.keys(result).sort()).toEqual(['body', 'htmlBody']);
  });
  it('handles rejection comments and messages without an HTML body', () => {
    expect(
      PrismaAccountErasureMapper.notification(
        { body: 'Motivo del rechazo: privado', htmlBody: null },
        'privado',
      ),
    ).toEqual({
      body: 'Motivo del rechazo: [Comentario del personal suprimido]',
      htmlBody: null,
    });
  });
});
