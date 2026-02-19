import { SupportService } from './support.service';

const mockPrisma = {
  supportTicket: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('SupportService', () => {
  let service: SupportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SupportService(mockPrisma as any);
  });

  describe('createTicket', () => {
    it('should create a support ticket successfully', async () => {
      const ticketData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Withdrawal issue',
        message: 'My withdrawal has been pending for 48 hours.',
      };

      mockPrisma.supportTicket.create.mockResolvedValue({
        id: 'ticket-001',
        ...ticketData,
        status: 'OPEN',
        createdAt: new Date(),
      });

      const result = await service.createTicket(ticketData);

      expect(result.success).toBe(true);
      expect(result.ticketId).toBe('ticket-001');
      expect(result.message).toContain('submitted');
      expect(mockPrisma.supportTicket.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
          subject: 'Withdrawal issue',
          message: 'My withdrawal has been pending for 48 hours.',
          status: 'OPEN',
        }),
      });
    });

    it('should set initial status to OPEN', async () => {
      mockPrisma.supportTicket.create.mockResolvedValue({
        id: 'ticket-002',
        status: 'OPEN',
      });

      await service.createTicket({
        name: 'Jane',
        email: 'jane@test.com',
        subject: 'Help',
        message: 'Need help',
      });

      const createCall = mockPrisma.supportTicket.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('OPEN');
    });

    it('should return ticket ID in response', async () => {
      mockPrisma.supportTicket.create.mockResolvedValue({
        id: 'unique-ticket-id-xyz',
      });

      const result = await service.createTicket({
        name: 'Test',
        email: 'test@test.com',
        subject: 'Test',
        message: 'Test message',
      });

      expect(result.ticketId).toBe('unique-ticket-id-xyz');
    });

    it('should include response time promise in message', async () => {
      mockPrisma.supportTicket.create.mockResolvedValue({ id: 'ticket-003' });

      const result = await service.createTicket({
        name: 'User',
        email: 'user@test.com',
        subject: 'Question',
        message: 'How do I deposit?',
      });

      expect(result.message).toContain('24 hours');
    });
  });

  describe('getTickets', () => {
    it('should return paginated ticket list', async () => {
      const mockTickets = [
        { id: 'ticket-1', name: 'User 1', subject: 'Issue 1', status: 'OPEN', createdAt: new Date() },
        { id: 'ticket-2', name: 'User 2', subject: 'Issue 2', status: 'OPEN', createdAt: new Date() },
      ];

      mockPrisma.supportTicket.findMany.mockResolvedValue(mockTickets);
      mockPrisma.supportTicket.count.mockResolvedValue(50);

      const result = await service.getTickets(undefined, 1, 20);

      expect(result.tickets).toEqual(mockTickets);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.totalPages).toBe(3); // ceil(50/20)
    });

    it('should filter by status when provided', async () => {
      mockPrisma.supportTicket.findMany.mockResolvedValue([]);
      mockPrisma.supportTicket.count.mockResolvedValue(0);

      await service.getTickets('OPEN', 1, 20);

      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'OPEN' },
        }),
      );
    });

    it('should not filter by status when not provided', async () => {
      mockPrisma.supportTicket.findMany.mockResolvedValue([]);
      mockPrisma.supportTicket.count.mockResolvedValue(0);

      await service.getTickets(undefined, 1, 20);

      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('should calculate correct pagination offset', async () => {
      mockPrisma.supportTicket.findMany.mockResolvedValue([]);
      mockPrisma.supportTicket.count.mockResolvedValue(0);

      await service.getTickets(undefined, 3, 10);

      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        }),
      );
    });

    it('should order tickets by createdAt descending', async () => {
      mockPrisma.supportTicket.findMany.mockResolvedValue([]);
      mockPrisma.supportTicket.count.mockResolvedValue(0);

      await service.getTickets();

      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should calculate totalPages correctly', async () => {
      mockPrisma.supportTicket.findMany.mockResolvedValue([]);
      mockPrisma.supportTicket.count.mockResolvedValue(45);

      const result = await service.getTickets(undefined, 1, 20);
      expect(result.pagination.totalPages).toBe(3); // ceil(45/20) = 3
    });

    it('should handle empty results', async () => {
      mockPrisma.supportTicket.findMany.mockResolvedValue([]);
      mockPrisma.supportTicket.count.mockResolvedValue(0);

      const result = await service.getTickets();
      expect(result.tickets).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });
});
