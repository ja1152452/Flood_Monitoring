import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';

const EMAIL_USER = process.env.EMAIL_USER || 'jayzelyasona23@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'vwnrbcswsbufmebo';
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = Number(process.env.EMAIL_PORT) || 587;

const sendOtpEmail = async (email, otp, fullName) => {
  try {
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: false,
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
    await transporter.sendMail({
      from: `"ResQConnect - Lumban MDRRMO" <${EMAIL_USER}>`,
      to: email,
      subject: 'ResQConnect - Email Verification Security Code',
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
          .container { max-width: 520px; margin: 30px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 32px; text-align: center; border-bottom: 3px solid #dc2626; }
          .brand { color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 0.5px; margin: 0; }
          .subbrand { color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; font-weight: 700; }
          .content { padding: 32px; color: #334155; line-height: 1.6; font-size: 14px; }
          .salutation { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
          .otp-box { background-color: #f1f5f9; border: 2px dashed #0284c7; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
          .otp-code { font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #0284c7; font-family: monospace; }
          .otp-notice { font-size: 12px; color: #64748b; margin-top: 8px; font-weight: 600; }
          .footer { background-color: #f8fafc; padding: 20px 32px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="brand">🚨 ResQConnect</h1>
            <div class="subbrand">Lumban Emergency Rescue & Disaster Monitoring</div>
          </div>
          <div class="content">
            <div class="salutation">Dear ${fullName || 'Resident'},</div>
            <p>Thank you for registering with <strong>ResQConnect</strong>, the official emergency monitoring and disaster rescue platform for Lumban, Laguna.</p>
            <p>To complete your account registration and verify your email address, please enter the one-time security verification code below:</p>
            
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <div class="otp-notice">⏱️ Valid for 2 minutes only</div>
            </div>

            <p>For your security, please do not share this code with anyone. System administrators and MDRRMO staff will never ask for your verification code.</p>
            <p>If you did not create an account with ResQConnect, please ignore this email.</p>
          </div>
          <div class="footer">
            This is an automated system security message from <strong>ResQConnect</strong> Administration.<br/>
            Municipal Disaster Risk Reduction and Management Office (MDRRMO) · Lumban, Laguna
          </div>
        </div>
      </body>
      </html>
    `,
    });
    console.log('[EMAIL] Verification OTP email successfully sent to:', email);
  } catch (emailErr) {
    console.error('[EMAIL] Failed to send OTP email:', emailErr.message);
  }
};

const signTokens = (userId, role) => ({
  accessToken: jwt.sign(
    { sub: userId, role },
    process.env.JWT_SECRET || 'lumban_flood_monitor_jwt_secret_key_2024',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  ),
  refreshToken: jwt.sign(
    { sub: userId, type: 'refresh' },
    process.env.REFRESH_TOKEN_SECRET || 'lumban_flood_monitor_refresh_secret_2024',
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' }
  ),
});

export const register = async (dto) => {
  const { rows: existing } = await query(
    'SELECT id FROM users WHERE email = $1',
    [dto.email.toLowerCase()]
  );
  if (existing.length) throw ApiError.conflict('Email already registered');

  const hash = await bcrypt.hash(dto.password, 12);

  const phone = dto.phone_number?.trim() || null;

  let barangayId = null;
  if (dto.barangay && dto.barangay.trim()) {
    const { rows: brgy } = await query(
      'SELECT id FROM barangays WHERE name ILIKE $1 LIMIT 1',
      [dto.barangay.trim()]
    );
    if (brgy.length) barangayId = brgy[0].id;
  }

  const { rows } = await query(
    `INSERT INTO users (email, password_hash, full_name, barangay_id, phone_number, is_active, email_verified, otp_attempts, otp_last_sent_at)
     VALUES ($1, $2, $3, $4, $5, false, false, 0, NOW())
     RETURNING id, email, role, full_name, created_at, is_active, email_verified`,
    [dto.email.toLowerCase(), hash, dto.full_name, barangayId, phone]
  );

  const user = rows[0];

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
  await query(
    `UPDATE users SET email_otp = $1, email_otp_expires_at = $2, otp_attempts = 0, otp_last_sent_at = NOW() WHERE id = $3`,
    [otp, expiresAt, user.id]
  );

  // Send the actual OTP verification email to user's inbox
  sendOtpEmail(user.email, otp, user.full_name).catch(console.error);

  // Return tokens so mobile app can call /verify-email on Step 3
  return { user, ...signTokens(user.id, user.role), autoVerified: false };
};

export const verifyEmail = async (userId, otp, email) => {
  let queryStr = 'SELECT id, email_otp, email_otp_expires_at, email_verified, otp_attempts FROM users WHERE ';
  let params = [];
  if (userId) {
    queryStr += 'id = $1';
    params = [userId];
  } else if (email) {
    queryStr += 'email = $1';
    params = [email.toLowerCase().trim()];
  } else {
    throw ApiError.badRequest('User ID or Email is required');
  }

  const { rows } = await query(queryStr, params);
  const user = rows[0];
  if (!user) throw ApiError.notFound('User account not found');
  if (user.email_verified) return;

  const currentAttempts = Number(user.otp_attempts || 0);

  // Check if locked from 5 attempts
  if (currentAttempts >= 5) {
    throw ApiError.badRequest('Maximum verification attempts exceeded (5/5). Your code is locked. Please tap Resend Code.');
  }

  if (!user.email_otp) {
    throw ApiError.badRequest('No active verification code. Please tap Resend Code.');
  }

  if (user.email_otp_expires_at && new Date() > new Date(user.email_otp_expires_at)) {
    throw ApiError.badRequest('Verification code has expired (2-minute limit). Please tap Resend Code.');
  }

  // Check if code matches
  if (String(user.email_otp).trim() !== String(otp).trim()) {
    const newAttempts = currentAttempts + 1;
    if (newAttempts >= 5) {
      await query(
        `UPDATE users SET otp_attempts = $1, email_otp = NULL, email_otp_expires_at = NULL WHERE id = $2`,
        [newAttempts, user.id]
      );
      throw ApiError.badRequest('Maximum verification attempts exceeded (5/5). Your code has been locked. Please tap Resend Code.');
    } else {
      await query(
        `UPDATE users SET otp_attempts = $1 WHERE id = $2`,
        [newAttempts, user.id]
      );
      const remaining = 5 - newAttempts;
      throw ApiError.badRequest(`Invalid verification code. ${remaining} attempt(s) remaining.`);
    }
  }

  // Success: activate account and clear OTP
  await query(
    `UPDATE users SET email_verified = true, is_active = true, email_otp = NULL, email_otp_expires_at = NULL, otp_attempts = 0 WHERE id = $1`,
    [user.id]
  );
};

export const resendOtp = async (userId, email) => {
  let queryStr = 'SELECT id, email, full_name, email_verified, otp_last_sent_at FROM users WHERE ';
  let params = [];
  if (userId) {
    queryStr += 'id = $1';
    params = [userId];
  } else if (email) {
    queryStr += 'email = $1';
    params = [email.toLowerCase().trim()];
  } else {
    throw ApiError.badRequest('User ID or Email is required');
  }

  const { rows } = await query(queryStr, params);
  const user = rows[0];
  if (!user) throw ApiError.notFound('User not found');
  if (user.email_verified) throw ApiError.conflict('Email already verified');

  const now = Date.now();
  if (user.otp_last_sent_at) {
    const elapsedMs = now - new Date(user.otp_last_sent_at).getTime();
    const cooldownMs = 100 * 1000; // 100 seconds
    if (elapsedMs < cooldownMs) {
      const remainingSec = Math.ceil((cooldownMs - elapsedMs) / 1000);
      throw ApiError.tooManyRequests(`Please wait ${remainingSec} seconds before requesting a new code.`);
    }
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(now + 2 * 60 * 1000); // 2 minutes
  await query(
    `UPDATE users SET email_otp = $1, email_otp_expires_at = $2, otp_attempts = 0, otp_last_sent_at = NOW() WHERE id = $3`,
    [otp, expiresAt, user.id]
  );

  sendOtpEmail(user.email, otp, user.full_name).catch(console.error);
};

export const login = async (dto) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.role, u.password_hash, u.full_name, u.is_active,
            u.phone_number, u.evacuation_center_id, u.barangay_id,
            u.email_verified,
            b.name AS barangay_name,
            ec.name AS evacuation_center_name
     FROM users u
     LEFT JOIN barangays b ON b.id = u.barangay_id
     LEFT JOIN evacuation_centers ec ON ec.id = u.evacuation_center_id
     WHERE u.email = $1`,
    [dto.email.toLowerCase()]
  );
  const user = rows[0];
  if (!user)                  throw ApiError.unauthorized('Invalid email or password');
  if (!user.is_active && !user.email_verified) throw ApiError.forbidden('Please verify your email before logging in');
  if (!user.is_active)        throw ApiError.forbidden('Your account has been deactivated. Contact the administrator.');

  const valid = await bcrypt.compare(dto.password, user.password_hash);
  if (!valid) throw ApiError.unauthorized('Invalid credentials');

  const { password_hash: _, ...safeUser } = user;
  return { user: safeUser, ...signTokens(user.id, user.role) };
};

export const refresh = async (token) => {
  let payload;
  try {
    payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }
  if (payload.type !== 'refresh') throw ApiError.unauthorized();

  const { rows } = await query(
    'SELECT id, role, is_active FROM users WHERE id = $1',
    [payload.sub]
  );
  if (!rows.length || !rows[0].is_active) throw ApiError.unauthorized();
  return signTokens(rows[0].id, rows[0].role);
};

export const updateFcmToken = async (userId, fcmToken) => {
  const tokenVal = (typeof fcmToken === 'string' && fcmToken.trim()) ? fcmToken.trim() : null;

  if (tokenVal) {
    // Dissociate this device token from any other account so push notifications only go to the active account on this device
    await query(
      'UPDATE users SET fcm_token = NULL WHERE fcm_token = $1 AND id != $2',
      [tokenVal, userId]
    );
  }

  await query(
    'UPDATE users SET fcm_token = $1, updated_at = NOW() WHERE id = $2',
    [tokenVal, userId]
  );
};

export const forgotPassword = async (email) => {
  const { rows } = await query(
    'SELECT id, full_name, email FROM users WHERE email = $1 AND is_active = true',
    [email.toLowerCase()]
  );
  // Always respond success to prevent email enumeration
  if (!rows.length) return;

  const user = rows[0];
  const otp  = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await query(
    `UPDATE users SET reset_otp = $1, reset_otp_expires_at = $2 WHERE id = $3`,
    [otp, expiresAt, user.id]
  );

  await transporter.sendMail({
    from: `"ResQConnect" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: 'ResQConnect - Password Reset Verification Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
          .container { max-width: 520px; margin: 30px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 32px; text-align: center; border-bottom: 3px solid #dc2626; }
          .brand { color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 0.5px; margin: 0; }
          .subbrand { color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; font-weight: 700; }
          .content { padding: 32px; color: #334155; line-height: 1.6; font-size: 14px; }
          .salutation { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
          .otp-box { background-color: #fef2f2; border: 2px dashed #dc2626; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
          .otp-code { font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #dc2626; font-family: monospace; }
          .otp-notice { font-size: 12px; color: #991b1b; margin-top: 8px; font-weight: 600; }
          .footer { background-color: #f8fafc; padding: 20px 32px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="brand">🚨 ResQConnect</h1>
            <div class="subbrand">Account Security & Password Control</div>
          </div>
          <div class="content">
            <div class="salutation">Dear ${user.full_name},</div>
            <p>We received a formal request to reset the password for your <strong>ResQConnect</strong> account.</p>
            <p>Please enter the one-time security verification code below to proceed with resetting your password:</p>

            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <div class="otp-notice">⏱️ Valid for 10 minutes only</div>
            </div>

            <p>For your security, do not share this password reset code with anyone. If you did not initiate this request, please disregard this email or contact MDRRMO administration immediately.</p>
          </div>
          <div class="footer">
            This is an automated system security message from <strong>ResQConnect</strong> Administration.<br/>
            Municipal Disaster Risk Reduction and Management Office (MDRRMO) · Lumban, Laguna
          </div>
        </div>
      </body>
      </html>
    `,
  });
};

export const resetPassword = async (email, otp, newPassword) => {
  const { rows } = await query(
    'SELECT id, reset_otp, reset_otp_expires_at FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  const user = rows[0];
  if (!user || !user.reset_otp || user.reset_otp !== otp)
    throw ApiError.badRequest('Invalid or expired reset code');
  if (new Date() > new Date(user.reset_otp_expires_at))
    throw ApiError.badRequest('Reset code has expired');

  const hash = await bcrypt.hash(newPassword, 12);
  await query(
    `UPDATE users SET password_hash = $1, reset_otp = NULL, reset_otp_expires_at = NULL, updated_at = NOW() WHERE id = $2`,
    [hash, user.id]
  );
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (!rows.length) throw ApiError.notFound('User not found');
  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid) throw ApiError.unauthorized('Current password is incorrect');
  const hash = await bcrypt.hash(newPassword, 12);
  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, userId]);
};

export const updateProfile = async (userId, dto) => {
  const fields = [];
  const values = [];
  let pi = 1;
  if (dto.full_name    !== undefined) { fields.push(`full_name = $${pi++}`);    values.push(dto.full_name); }
  if (dto.phone_number !== undefined) { fields.push(`phone_number = $${pi++}`); values.push(dto.phone_number || null); }
  if (!fields.length) throw ApiError.badRequest('Nothing to update');
  values.push(userId);
  const { rows } = await query(
    `UPDATE users SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${pi}
     RETURNING id, email, full_name, phone_number, role, barangay_id`,
    values
  );
  return rows[0];
};

export const updateAvatar = async (userId, filename) => {
  const avatarUrl = `/uploads/avatars/${filename}`;
  const { rows } = await query(
    'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id, avatar_url',
    [avatarUrl, userId]
  );
  return rows[0];
};