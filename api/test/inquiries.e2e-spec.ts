import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp, TestApp } from './support/test-app.js';

const MISSING_ID = '6b6c0f0e-9d6a-4d6e-8d52-3f2b8d5f2a11';
const contact = {
  type: 'CONTACT',
  name: 'Priya Sharma',
  email: 'Priya@Example.com',
  subject: 'Pricing for a web app',
  message: 'Hi, we would like to build an MVP web app. Can you share a rough estimate?',
};
const project = {
  type: 'PROJECT',
  name: 'Rahul Verma',
  email: 'rahul@example.com',
  company: 'Acme Pvt Ltd',
  serviceInterest: 'web-application-development',
  budgetRange: '5K_15K',
  timeline: '1_3_MONTHS',
  message: 'We need a customer portal with role-based access and reporting dashboards.',
  source: 'MOBILE',
};

describe('inquiries', () => {
  let testApp: TestApp;
  const submit = (body: object) => testApp.anonymous().post('/api/v1/public/inquiries').send(body);
  const admin = (suffix = '') => `/api/v1/admin/inquiries${suffix}`;
  const stored = () => [...testApp.inquiries.inquiries.values()];

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  afterEach(() => testApp.close());

  describe('public submit', () => {
    it('stores a contact inquiry with a normalised email and notifies the admins', async () => {
      const response = await submit(contact).expect(201);

      expect(response.body.data.message).toContain('Thanks');
      expect(stored()).toHaveLength(1);
      expect(stored()[0]).toMatchObject({ email: 'priya@example.com', source: 'WEB', status: 'NEW' });
      await vi.waitFor(() => expect(testApp.mail.sent).toHaveLength(1));
      const [mail] = testApp.mail.sent;
      expect(mail.to).toEqual(['owner@zoycoders.test', 'sales@zoycoders.test']);
      expect(mail.text).toContain(`/admin/inquiries/${stored()[0].id}`);
      expect(mail.text).not.toContain('MVP web app');
    });

    it('stores a project inquiry from mobile without subject or spam fields', async () => {
      await submit(project).expect(201);

      expect(stored()[0]).toMatchObject({ type: 'PROJECT', source: 'MOBILE', subject: null, serviceInterest: 'web-application-development' });
    });

    it('accepts other as the service of interest', async () => {
      await submit({ ...project, serviceInterest: 'other' }).expect(201);
    });

    it.each([
      ['a contact without a subject', { ...contact, subject: undefined }],
      ['a project without a service', { ...project, serviceInterest: undefined }],
      ['a service that is not a slug', { ...project, serviceInterest: 'Web App!' }],
      ['a short message', { ...contact, message: 'too short' }],
      ['an invalid email', { ...contact, email: 'nope' }],
      ['an unknown budget', { ...project, budgetRange: 'HUGE' }],
      ['an unknown type', { ...contact, type: 'SALES' }],
      ['an unknown field', { ...contact, admin: true }],
    ])('rejects %s', async (_label, body) => {
      await submit(body).expect(400);

      expect(stored()).toHaveLength(0);
    });

    it('answers 201 but stores nothing when the honeypot is filled', async () => {
      await submit({ ...contact, website: 'http://spam.example' }).expect(201);

      expect(stored()).toHaveLength(0);
      expect(testApp.mail.sent).toHaveLength(0);
    });

    it('answers 201 but stores nothing when submitted within 3 seconds of rendering', async () => {
      await submit({ ...contact, renderedAt: Date.now() - 500 }).expect(201);

      expect(stored()).toHaveLength(0);
    });

    it('stores a submission that took long enough or has a clock in the future', async () => {
      await submit({ ...contact, renderedAt: Date.now() - 10_000 }).expect(201);
      await submit({ ...contact, email: 'b@example.com', renderedAt: Date.now() + 60_000 }).expect(201);

      expect(stored()).toHaveLength(2);
    });

    it('treats the same email and message within 10 minutes as a duplicate', async () => {
      await submit(contact).expect(201);
      await submit({ ...contact, email: 'PRIYA@example.com' }).expect(201);
      await submit({ ...contact, message: `${contact.message} Thanks again.` }).expect(201);

      expect(stored()).toHaveLength(2);
      await vi.waitFor(() => expect(testApp.mail.sent).toHaveLength(2));
    });

    it('still stores the inquiry and audits when the notification email fails', async () => {
      vi.spyOn(testApp.mail, 'send').mockRejectedValueOnce(new Error('smtp down'));

      await submit(contact).expect(201);

      await vi.waitFor(() => expect(testApp.audit.entries.some((entry) => entry.action === 'notification.failed')).toBe(true));
      expect(stored()).toHaveLength(1);
      expect(testApp.audit.entries.at(-1)).toMatchObject({ adminId: null, entityId: stored()[0].id });
    });
  });

  describe('admin', () => {
    const seed = async () => {
      await submit(contact).expect(201);
      await submit(project).expect(201);
      testApp.mail.sent.length = 0;
    };

    it('requires an admin session', async () => {
      await testApp.anonymous().get(admin()).expect(401);
      await testApp.anonymous().delete(admin(`/${MISSING_ID}`)).expect(401);
    });

    it('lists with filters, search and sorting', async () => {
      await seed();

      const all = (await testApp.admin.get(admin()).expect(200)).body;
      const projects = (await testApp.admin.get(`${admin()}?type=PROJECT`).expect(200)).body;
      const search = (await testApp.admin.get(`${admin()}?q=priya`).expect(200)).body;
      const byName = (await testApp.admin.get(`${admin()}?sort=name:asc`).expect(200)).body;

      expect(all.meta.total).toBe(2);
      expect(all.data[0]).not.toHaveProperty('message');
      expect(projects.data.map((i: { name: string }) => i.name)).toEqual(['Rahul Verma']);
      expect(search.data).toHaveLength(1);
      expect(byName.data[0].name).toBe('Priya Sharma');
      await testApp.admin.get(`${admin()}?status=DONE`).expect(400);
      await testApp.admin.get(`${admin()}?sort=email:asc`).expect(400);
    });

    it('shows detail without changing the status', async () => {
      await seed();
      const { id } = stored()[0];

      const response = await testApp.admin.get(admin(`/${id}`)).expect(200);

      expect(response.body.data).toMatchObject({ status: 'NEW', replies: [], message: contact.message });
      await testApp.admin.get(admin(`/${MISSING_ID}`)).expect(404);
      await testApp.admin.get(admin('/nope')).expect(400);
    });

    it('moves between NEW and IN_PROGRESS and never to REPLIED by hand', async () => {
      await seed();
      const { id } = stored()[0];

      const progress = await testApp.admin.patch(admin(`/${id}/status`)).send({ status: 'IN_PROGRESS' }).expect(200);
      await testApp.admin.patch(admin(`/${id}/status`)).send({ status: 'NEW' }).expect(200);
      await testApp.admin.patch(admin(`/${id}/status`)).send({ status: 'REPLIED' }).expect(400);

      expect(progress.body.data.status).toBe('IN_PROGRESS');
      expect(testApp.audit.entries.some((entry) => entry.action === 'inquiry.status')).toBe(true);
    });

    it('does not allow a replied inquiry back to NEW', async () => {
      await seed();
      const { id } = stored()[0];
      await testApp.admin.post(admin(`/${id}/replies`)).send({ subject: 'Re: pricing', body: 'Here is the estimate.' }).expect(201);

      await testApp.admin.patch(admin(`/${id}/status`)).send({ status: 'NEW' }).expect(409);
      const reopened = await testApp.admin.patch(admin(`/${id}/status`)).send({ status: 'IN_PROGRESS' }).expect(200);

      expect(reopened.body.data.status).toBe('IN_PROGRESS');
    });

    it('deletes an inquiry and its replies', async () => {
      await seed();
      const { id } = stored()[0];
      await testApp.admin.post(admin(`/${id}/replies`)).send({ subject: 'Re: pricing', body: 'Here is the estimate.' }).expect(201);

      await testApp.admin.delete(admin(`/${id}`)).expect(204);

      expect(stored()).toHaveLength(1);
      expect(testApp.inquiries.replies.size).toBe(0);
      await testApp.admin.delete(admin(`/${id}`)).expect(404);
      expect(testApp.audit.entries.at(-1)).toMatchObject({ action: 'inquiry.delete', entityId: id });
    });

    describe('replies', () => {
      const reply = { subject: 'Re: pricing', body: 'Here is the estimate you asked for.' };

      it('sends the email, marks the reply SENT and the inquiry REPLIED', async () => {
        await seed();
        const { id, email } = stored()[0];

        const response = await testApp.admin.post(admin(`/${id}/replies`)).send(reply).expect(201);

        expect(response.body.data.inquiryStatus).toBe('REPLIED');
        expect(response.body.data.reply).toMatchObject({ deliveryStatus: 'SENT', attempts: 1, errorMessage: null, sentBy: { name: 'Zoy Admin' } });
        expect(testApp.mail.sent).toEqual([{ to: email, subject: reply.subject, text: reply.body }]);
        const detail = (await testApp.admin.get(admin(`/${id}`)).expect(200)).body.data;
        expect(detail.replies).toHaveLength(1);
      });

      it('returns 201 with FAILED and leaves the status when the provider fails', async () => {
        await seed();
        const { id } = stored()[0];
        vi.spyOn(testApp.mail, 'send').mockRejectedValueOnce(new Error('mailbox unavailable'));

        const response = await testApp.admin.post(admin(`/${id}/replies`)).send(reply).expect(201);

        expect(response.body.data.inquiryStatus).toBe('NEW');
        expect(response.body.data.reply).toMatchObject({ deliveryStatus: 'FAILED', attempts: 1, errorMessage: 'mailbox unavailable' });
      });

      it('retries a failed reply up to 3 attempts in total', async () => {
        await seed();
        const { id } = stored()[0];
        const send = vi.spyOn(testApp.mail, 'send').mockRejectedValue(new Error('still down'));
        const { reply: failed } = (await testApp.admin.post(admin(`/${id}/replies`)).send(reply).expect(201)).body.data;
        const retryUrl = admin(`/${id}/replies/${failed.id}/retry`);

        const second = await testApp.admin.post(retryUrl).expect(200);
        const third = await testApp.admin.post(retryUrl).expect(200);
        await testApp.admin.post(retryUrl).expect(409);

        expect(second.body.data.reply.attempts).toBe(2);
        expect(third.body.data.reply).toMatchObject({ attempts: 3, deliveryStatus: 'FAILED' });
        expect(send).toHaveBeenCalledTimes(3);
      });

      it('marks the inquiry REPLIED when a retry succeeds', async () => {
        await seed();
        const { id } = stored()[0];
        vi.spyOn(testApp.mail, 'send').mockRejectedValueOnce(new Error('blip'));
        const { reply: failed } = (await testApp.admin.post(admin(`/${id}/replies`)).send(reply).expect(201)).body.data;

        const retried = await testApp.admin.post(admin(`/${id}/replies/${failed.id}/retry`)).expect(200);

        expect(retried.body.data).toMatchObject({ inquiryStatus: 'REPLIED', reply: { deliveryStatus: 'SENT', attempts: 2, errorMessage: null } });
      });

      it('refuses to retry a reply that was sent or does not exist', async () => {
        await seed();
        const { id } = stored()[0];
        const { reply: sent } = (await testApp.admin.post(admin(`/${id}/replies`)).send(reply).expect(201)).body.data;

        await testApp.admin.post(admin(`/${id}/replies/${sent.id}/retry`)).expect(409);
        await testApp.admin.post(admin(`/${id}/replies/${MISSING_ID}/retry`)).expect(404);
        await testApp.admin.post(admin(`/${MISSING_ID}/replies/${sent.id}/retry`)).expect(404);
      });

      it('validates the reply and the inquiry id', async () => {
        await seed();
        const { id } = stored()[0];

        await testApp.admin.post(admin(`/${id}/replies`)).send({ subject: 'x', body: 'long enough body text' }).expect(400);
        await testApp.admin.post(admin(`/${id}/replies`)).send({ subject: 'Re: pricing', body: 'short' }).expect(400);
        await testApp.admin.post(admin(`/${MISSING_ID}/replies`)).send(reply).expect(404);
      });

      it('times out a hanging email provider and records the failure', async () => {
        await seed();
        const { id } = stored()[0];
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        vi.spyOn(testApp.mail, 'send').mockImplementationOnce(() => new Promise(() => undefined));

        const pending = testApp.admin.post(admin(`/${id}/replies`)).send(reply).then((response) => response);
        await vi.waitFor(() => expect(testApp.inquiries.replies.size).toBe(1));
        await vi.advanceTimersByTimeAsync(10_000);
        vi.useRealTimers();
        const response = await pending;

        expect(response.body.data.reply).toMatchObject({ deliveryStatus: 'FAILED', errorMessage: 'The email provider did not respond in time' });
      });
    });
  });
});
