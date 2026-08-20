/*
  Thin wrapper around MSAL.js (loaded via CDN in each HTML page).
  Handles Microsoft 365 sign-in and getting a Graph access token.
*/

const msalInstance = new msal.PublicClientApplication({
  auth: {
    clientId: window.APP_CONFIG.msal.clientId,
    authority: window.APP_CONFIG.msal.authority,
    redirectUri: window.APP_CONFIG.msal.redirectUri,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
});

let currentAccount = null;

async function initAuth() {
  await msalInstance.initialize();
  const result = await msalInstance.handleRedirectPromise();
  if (result && result.account) {
    currentAccount = result.account;
  } else {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) currentAccount = accounts[0];
  }
  return currentAccount;
}

async function signIn() {
  const result = await msalInstance.loginPopup({
    scopes: window.APP_CONFIG.graphScopes,
  });
  currentAccount = result.account;
  return currentAccount;
}

function signOut() {
  msalInstance.logoutRedirect({ account: currentAccount });
}

async function getGraphToken() {
  if (!currentAccount) throw new Error("Not signed in");
  const request = {
    scopes: window.APP_CONFIG.graphScopes,
    account: currentAccount,
  };
  try {
    const result = await msalInstance.acquireTokenSilent(request);
    return result.accessToken;
  } catch (e) {
    const result = await msalInstance.acquireTokenPopup(request);
    return result.accessToken;
  }
}

function getCurrentUserEmail() {
  if (!currentAccount) return null;
  return (currentAccount.username || "").toLowerCase();
}
