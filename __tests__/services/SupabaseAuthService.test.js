const mockSignUp = jest.fn();

jest.mock('../../config/supabase', () => ({
  getSupabaseOrThrow: jest.fn(() => ({
    auth: {
      signUp: mockSignUp,
    },
  })),
}));

describe('SupabaseAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes signup metadata to Supabase auth', async () => {
    mockSignUp.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });

    const { SupabaseAuthService } = require('../../services/supabase/SupabaseAuthService');

    await SupabaseAuthService.signUp('alex@example.com', 'password123', {
      display_name: 'Alex',
      full_name: 'Alex',
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'alex@example.com',
      password: 'password123',
      options: {
        data: {
          display_name: 'Alex',
          full_name: 'Alex',
        },
      },
    });
  });

  it('omits signup metadata when none is provided', async () => {
    mockSignUp.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });

    const { SupabaseAuthService } = require('../../services/supabase/SupabaseAuthService');

    await SupabaseAuthService.signUp('alex@example.com', 'password123');

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'alex@example.com',
      password: 'password123',
    });
  });
});
