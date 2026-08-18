// Minimal @clerk/expo stub for the Node/Jest test environment.
const useAuth = () => ({ userId: 'test-user-id', isSignedIn: true, getToken: async () => 'token' });
const useUser = () => ({ user: { id: 'test-user-id' }, isSignedIn: true });
const useClerk = () => ({ signOut: jest.fn() });
const ClerkProvider = ({ children }) => children;
const SignedIn = ({ children }) => children;
const SignedOut = ({ children }) => children;

module.exports = { useAuth, useUser, useClerk, ClerkProvider, SignedIn, SignedOut };
