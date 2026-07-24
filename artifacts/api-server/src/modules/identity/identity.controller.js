import {
  registerCarrier,
  registerShipper,
  login,
  setAuthCookies,
  clearAuthCookies,
} from './identity.service.js';

export async function handleRegisterCarrier(req, res, next) {
  try {
    const result = await registerCarrier(req.body);
    res.status(201).json({
      id: result.id,
      status: result.status,
      message: 'Registration submitted successfully. Your account is pending admin activation.',
    });
  } catch (err) {
    next(err);
  }
}

export async function handleRegisterShipper(req, res, next) {
  try {
    const result = await registerShipper(req.body);
    res.status(201).json({
      id: result.id,
      status: result.status,
      message: 'Registration submitted successfully. Your account is pending admin activation.',
    });
  } catch (err) {
    next(err);
  }
}

export async function handleLogin(req, res, next) {
  try {
    const { user, accessToken, refreshToken } = await login(req.body);
    setAuthCookies(res, { accessToken, refreshToken });
    res.json({ user, role: user.role });
  } catch (err) {
    next(err);
  }
}

export async function handleLogout(req, res) {
  clearAuthCookies(res);
  res.json({ success: true, message: 'Logged out successfully' });
}

export async function handleGetCurrentUser(req, res) {
  res.json(req.user);
}
