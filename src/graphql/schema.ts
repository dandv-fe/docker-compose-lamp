import {
  GraphQLBoolean, GraphQLEnumType, GraphQLFloat, GraphQLID, GraphQLInputObjectType, GraphQLInt,
  GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLScalarType, GraphQLSchema,
  GraphQLString, valueFromASTUntyped,
} from 'graphql';
import { login, type AuthContext } from '../services/auth.js';
import { applyOfflineOperation, type OfflineInput } from '../services/operations.js';
import {
  branches, branchPermissions, cancelledCredits, customerByDocument, customerById, customerCandidate, personDocumentTypes,
  bankAccounts, defaultersOfPortfolio, me, openRouteCash, paymentHistory, portfolio, portfolioClients, receiptSequences,
  restoreCredit, syncChanges, withdrawnOfPortfolio,
} from '../services/queries.js';
import { routeSettlement, settleRoute, routeExpenseCatalog, routeEntries } from '../services/settlement.js';
import { fail } from '../services/errors.js';
import { z } from 'zod';

export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON object or scalar value',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (ast) => valueFromASTUntyped(ast),
});

const BranchType = new GraphQLObjectType({
  name: 'Branch',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLInt) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    type: { type: GraphQLString },
    extraCharge: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const userFields = {
    userId: { type: new GraphQLNonNull(GraphQLInt) },
    companyId: { type: new GraphQLNonNull(GraphQLInt) },
    employeeId: { type: GraphQLInt },
    employeeMaxCredit: { type: GraphQLFloat },
    isSuperAdministrator: {
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: (user: { cargo: string | null }) => user.cargo === 'Super Administrador',
    },
    username: { type: new GraphQLNonNull(GraphQLString) },
    firstName: { type: new GraphQLNonNull(GraphQLString) },
    lastName: { type: new GraphQLNonNull(GraphQLString) },
    companyName: { type: new GraphQLNonNull(GraphQLString) },
};

const BasicUserType = new GraphQLObjectType({
  name: 'UserBasics',
  fields: userFields,
});

const AuthContextType = new GraphQLObjectType({
  name: 'AuthenticatedUser',
  fields: {
    ...userFields,
    branches: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(BranchType))) },
  },
});

const AuthPayloadType = new GraphQLObjectType({
  name: 'AuthPayload',
  fields: {
    token: { type: new GraphQLNonNull(GraphQLString) },
    expiresIn: { type: new GraphQLNonNull(GraphQLInt) },
    paymentExpiresAt: { type: GraphQLFloat },
    user: { type: new GraphQLNonNull(BasicUserType) },
    company: { type: new GraphQLNonNull(new GraphQLObjectType({
      name: 'CompanyBasics',
      fields: {
        id: { type: new GraphQLNonNull(GraphQLInt) },
        name: { type: new GraphQLNonNull(GraphQLString) },
      },
    })) },
    branches: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(BranchType))) },
  },
});

const PaymentType = new GraphQLObjectType({
  name: 'Payment',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) }, creditId: { type: new GraphQLNonNull(GraphQLID) },
    amount: { type: new GraphQLNonNull(GraphQLFloat) }, description: { type: GraphQLString },
    state: { type: GraphQLString }, createdAt: { type: GraphQLString }, updatedAt: { type: GraphQLString },
    routeId: { type: GraphQLInt },
    createdByUserId: { type: GraphQLInt }, createdByUsername: { type: GraphQLString },
    origin: { type: GraphQLString },
    bankAmount: { type: GraphQLFloat },
  },
});

const ReceiptSequenceType = new GraphQLObjectType({
  name: 'ReceiptSequence',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLInt) },
    documentType: { type: new GraphQLNonNull(GraphQLString) },
    series: { type: GraphQLString },
    lastNumber: { type: GraphQLString },
  },
});

const BankAccountType = new GraphQLObjectType({
  name: 'BankAccount',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLInt) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    type: { type: GraphQLString },
    number: { type: GraphQLString },
    holderName: { type: GraphQLString },
    holderDocument: { type: GraphQLString },
  },
});

const RouteMovementType = new GraphQLObjectType({
  name: 'RouteMovement',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    kind: { type: new GraphQLNonNull(GraphQLString) },
    title: { type: new GraphQLNonNull(GraphQLString) },
    detail: { type: GraphQLString },
    amount: { type: new GraphQLNonNull(GraphQLFloat) },
    bankAmount: { type: new GraphQLNonNull(GraphQLFloat) },
    countsForCash: { type: new GraphQLNonNull(GraphQLBoolean) },
    cashAmount: { type: new GraphQLNonNull(GraphQLFloat) },
    personId: { type: GraphQLInt },
    personName: { type: GraphQLString },
    state: { type: GraphQLString },
    createdAt: { type: GraphQLString },
  },
});

const RouteCollectorType = new GraphQLObjectType({
  name: 'RouteCollector',
  fields: {
    personId: { type: GraphQLInt },
    personName: { type: GraphQLString },
    cash: { type: new GraphQLNonNull(GraphQLFloat) },
    movements: { type: new GraphQLNonNull(GraphQLInt) },
    isMe: { type: new GraphQLNonNull(GraphQLBoolean) },
  },
});

const RouteSettlementType = new GraphQLObjectType({
  name: 'RouteSettlement',
  fields: {
    routeId: { type: GraphQLInt },
    state: { type: GraphQLString },
    canSettle: { type: new GraphQLNonNull(GraphQLBoolean) },
    base: { type: new GraphQLNonNull(GraphQLFloat) },
    collected: { type: new GraphQLNonNull(GraphQLFloat) },
    collectedBank: { type: new GraphQLNonNull(GraphQLFloat) },
    otherCollected: { type: new GraphQLNonNull(GraphQLFloat) },
    credits: { type: new GraphQLNonNull(GraphQLFloat) },
    creditsBank: { type: new GraphQLNonNull(GraphQLFloat) },
    expenses: { type: new GraphQLNonNull(GraphQLFloat) },
    expectedCash: { type: new GraphQLNonNull(GraphQLFloat) },
    movements: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(RouteMovementType))) },
    collectors: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(RouteCollectorType))) },
  },
});

const ExpenseCategoryType = new GraphQLObjectType({
  name: 'ExpenseCategory',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLInt) },
    category: { type: new GraphQLNonNull(GraphQLString) },
    names: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))) },
  },
});

const PayrollType = new GraphQLObjectType({
  name: 'Payroll',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLInt) },
    name: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const RouteEntryType = new GraphQLObjectType({
  name: 'RouteEntry',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    kind: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    detail: { type: new GraphQLNonNull(GraphQLString) },
    amount: { type: new GraphQLNonNull(GraphQLFloat) },
    accountingType: { type: GraphQLInt },
    payrollId: { type: GraphQLInt },
    personName: { type: GraphQLString },
    state: { type: GraphQLString },
    createdAt: { type: GraphQLString },
  },
});

const ExpenseCatalogType = new GraphQLObjectType({
  name: 'ExpenseCatalog',
  fields: {
    categories: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(ExpenseCategoryType))) },
    payrolls: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PayrollType))) },
  },
});

const RouteCashType = new GraphQLObjectType({
  name: 'RouteCash',
  fields: {
    routeId: { type: GraphQLInt },
    routeState: { type: GraphQLString },
    base: { type: new GraphQLNonNull(GraphQLFloat) },
    otherIncome: { type: new GraphQLNonNull(GraphQLFloat) },
    expenses: { type: new GraphQLNonNull(GraphQLFloat) },
  },
});

const CreditType = new GraphQLObjectType({
  name: 'Credit',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    companyId: { type: new GraphQLNonNull(GraphQLInt) },
    branchId: { type: new GraphQLNonNull(GraphQLInt) },
    customerId: { type: new GraphQLNonNull(GraphQLInt) },
    routeId: { type: new GraphQLNonNull(GraphQLInt) },
    saleId: { type: GraphQLInt },
    concept: { type: GraphQLString }, value: { type: GraphQLFloat },
    frequency: { type: GraphQLString }, term: { type: GraphQLInt },
    principal: { type: GraphQLFloat }, balance: { type: GraphQLFloat },
    description: { type: GraphQLString }, sortOrder: { type: GraphQLFloat },
    profit: { type: GraphQLFloat }, additionalNumber: { type: GraphQLString },
    additionalValue: { type: GraphQLFloat }, receiptType: { type: GraphQLString },
    receiptSeries: { type: GraphQLString }, receiptNumber: { type: GraphQLString },
    paymentSummary: { type: GraphQLString }, style: { type: GraphQLString },
    note: { type: GraphQLString }, status: { type: GraphQLString },
    createdEmployeeId: { type: GraphQLInt }, agreementDate: { type: GraphQLString },
    createdAt: { type: GraphQLString }, updatedAt: { type: GraphQLString },
    bankFunded: { type: GraphQLFloat },
    latestPayment: { type: PaymentType },
  },
});

const CommentType = new GraphQLObjectType({
  name: 'CustomerComment',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    customerId: { type: new GraphQLNonNull(GraphQLInt) },
    comment: { type: new GraphQLNonNull(GraphQLString) },
    type: { type: new GraphQLNonNull(GraphQLString) },
    userId: { type: new GraphQLNonNull(GraphQLInt) },
    createdAt: { type: GraphQLString },
    updatedAt: { type: GraphQLString },
  },
});

const CustomerType = new GraphQLObjectType({
  name: 'Customer',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLInt) },
    companyId: { type: new GraphQLNonNull(GraphQLInt) },
    personId: { type: new GraphQLNonNull(GraphQLInt) },
    firstName: { type: new GraphQLNonNull(GraphQLString) },
    lastName: { type: new GraphQLNonNull(GraphQLString) },
    sex: { type: GraphQLString }, birthDate: { type: GraphQLString },
    documentType: { type: GraphQLString }, documentNumber: { type: GraphQLString },
    phone: { type: GraphQLString }, email: { type: GraphQLString }, photo: { type: GraphQLString },
    occupation: { type: GraphQLString }, personStatus: { type: GraphQLString },
    personNote: { type: GraphQLString }, department: { type: GraphQLString },
    city: { type: GraphQLString }, neighborhood: { type: GraphQLString }, street: { type: GraphQLString },
    maxCredit: { type: GraphQLFloat }, nickname: { type: GraphQLString }, note: { type: GraphQLString },
    status: { type: GraphQLString }, rating: { type: GraphQLString }, guarantorPersonId: { type: GraphQLInt },
    credits: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(CreditType))) },
    comments: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(CommentType))) },
  },
});

const CustomerCandidateType = new GraphQLObjectType({
  name: 'CustomerCandidate',
  fields: {
    personId: { type: new GraphQLNonNull(GraphQLInt) },
    customerId: { type: GraphQLInt },
    firstName: { type: GraphQLString }, lastName: { type: GraphQLString },
    sex: { type: GraphQLString }, birthDate: { type: GraphQLString },
    documentType: { type: GraphQLString }, documentNumber: { type: GraphQLString },
    phone: { type: GraphQLString }, email: { type: GraphQLString },
    occupation: { type: GraphQLString }, personNote: { type: GraphQLString },
    department: { type: GraphQLString }, city: { type: GraphQLString },
    neighborhood: { type: GraphQLString }, street: { type: GraphQLString },
  },
});

const PersonDocumentType = new GraphQLObjectType({
  name: 'PersonDocumentType',
  fields: { name: { type: new GraphQLNonNull(GraphQLString) } },
});

const PortfolioType = new GraphQLObjectType({
  name: 'PortfolioPage',
  fields: {
    nodes: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(CustomerType))) },
    snapshotCursor: { type: new GraphQLNonNull(GraphQLString) },
    nextCursor: { type: GraphQLString },
    hasNextPage: { type: new GraphQLNonNull(GraphQLBoolean) },
  },
});

const ChangeType = new GraphQLObjectType({
  name: 'SyncChange',
  fields: {
    cursor: { type: new GraphQLNonNull(GraphQLString) },
    recordType: { type: new GraphQLNonNull(GraphQLString) },
    recordId: { type: new GraphQLNonNull(GraphQLString) },
    action: { type: new GraphQLNonNull(GraphQLString) },
    createdAt: { type: GraphQLString },
    payload: { type: JSONScalar },
  },
});

const SyncPageType = new GraphQLObjectType({
  name: 'SyncChangesPage',
  fields: {
    nodes: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(ChangeType))) },
    nextCursor: { type: new GraphQLNonNull(GraphQLString) },
    hasNextPage: { type: new GraphQLNonNull(GraphQLBoolean) },
  },
});

const OperationKind = new GraphQLEnumType({
  name: 'OfflineOperationKind',
  values: {
    CREATE_CUSTOMER: {}, UPDATE_CUSTOMER: {}, UPDATE_DOCUMENT: {}, CREATE_CREDIT: {},
    UPDATE_CREDIT: {}, UPDATE_CREDIT_TERMS: {}, CREATE_PAYMENT: {}, UPDATE_PAYMENT: {},
    DELETE_PAYMENT: {}, DELETE_CREDIT: {}, APPLY_DISCOUNT: {}, ADD_INTEREST: {},
    CHANGE_CREDIT_STATUS: {}, REORDER_CREDIT: {}, CREATE_COMMENT: {}, UPDATE_COMMENT: {},
    DELETE_COMMENT: {}, UPSERT_ALERT: {}, CREATE_EXPENSE: {}, UPDATE_EXPENSE: {},
    DELETE_EXPENSE: {}, CREATE_BASE: {}, UPDATE_BASE: {}, DELETE_BASE: {},
  },
});

const OfflineInputType = new GraphQLInputObjectType({
  name: 'OfflineOperationInput',
  fields: {
    operationId: { type: new GraphQLNonNull(GraphQLString) },
    branchId: { type: new GraphQLNonNull(GraphQLInt) },
    kind: { type: new GraphQLNonNull(OperationKind) },
    entityId: { type: new GraphQLNonNull(GraphQLString) },
    baseVersion: { type: GraphQLString },
    routeId: { type: GraphQLInt },
    payload: { type: new GraphQLNonNull(JSONScalar) },
  },
});

const OperationResultType = new GraphQLObjectType({
  name: 'OfflineOperationResult',
  fields: {
    operationId: { type: new GraphQLNonNull(GraphQLString) },
    status: { type: new GraphQLNonNull(GraphQLString) },
    entityId: { type: new GraphQLNonNull(GraphQLString) },
    data: { type: JSONScalar },
    eventCursor: { type: new GraphQLNonNull(GraphQLString) },
    replayed: { type: GraphQLBoolean },
  },
});

// --- Cartera sub-screens: Morosos, Retirados, Canceladas, Clientes De Cartera ---
const DefaulterCreditType = new GraphQLObjectType({
  name: 'DefaulterCredit',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    balance: { type: GraphQLFloat }, principal: { type: GraphQLFloat }, value: { type: GraphQLFloat },
    additionalValue: { type: GraphQLFloat }, createdAt: { type: GraphQLString },
    customerName: { type: GraphQLString },
    documentType: { type: GraphQLString }, documentNumber: { type: GraphQLString },
    phone: { type: GraphQLString },
  },
});

const WithdrawnCreditType = new GraphQLObjectType({
  name: 'WithdrawnCredit',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    balance: { type: GraphQLFloat }, principal: { type: GraphQLFloat }, value: { type: GraphQLFloat },
    additionalValue: { type: GraphQLFloat }, createdAt: { type: GraphQLString },
    customerName: { type: GraphQLString },
    documentType: { type: GraphQLString }, documentNumber: { type: GraphQLString },
    phone: { type: GraphQLString }, status: { type: GraphQLString },
  },
});

const CancelledCreditType = new GraphQLObjectType({
  name: 'CancelledCredit',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    value: { type: GraphQLFloat }, principal: { type: GraphQLFloat }, additionalValue: { type: GraphQLFloat },
    createdAt: { type: GraphQLString }, customerName: { type: GraphQLString },
    documentType: { type: GraphQLString }, documentNumber: { type: GraphQLString },
    phone: { type: GraphQLString }, paidAmount: { type: GraphQLFloat },
    description: { type: GraphQLString }, cancelledAt: { type: GraphQLString },
  },
});

const PortfolioClientType = new GraphQLObjectType({
  name: 'PortfolioClient',
  fields: {
    personId: { type: new GraphQLNonNull(GraphQLInt) },
    firstName: { type: GraphQLString }, lastName: { type: GraphQLString },
    documentType: { type: GraphQLString }, documentNumber: { type: GraphQLString },
    sex: { type: GraphQLString }, birthDate: { type: GraphQLString }, occupation: { type: GraphQLString },
    phone: { type: GraphQLString }, email: { type: GraphQLString }, department: { type: GraphQLString },
    city: { type: GraphQLString }, neighborhood: { type: GraphQLString }, street: { type: GraphQLString },
    customerStatus: { type: GraphQLString }, maxCredit: { type: GraphQLFloat }, nickname: { type: GraphQLString },
  },
});

const RestoreCreditResultType = new GraphQLObjectType({
  name: 'RestoreCreditResult',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    previousState: { type: new GraphQLNonNull(GraphQLString) },
    state: { type: new GraphQLNonNull(GraphQLString) },
  },
});

function auth(context: { auth: AuthContext | null }) { return context.auth; }

const loginArgs = z.object({
  companyId: z.number().int().positive(),
  username: z.string().min(1),
  password: z.string(),
});

const Query = new GraphQLObjectType({
  name: 'Query',
  fields: {
    me: { type: AuthContextType, resolve: (_source, _args, context: { auth: AuthContext | null }) => me(auth(context)) },
    branches: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(BranchType))), resolve: (_source, _args, context: { auth: AuthContext | null }) => branches(auth(context)) },
    portfolio: {
      type: new GraphQLNonNull(PortfolioType),
      args: {
        branchId: { type: new GraphQLNonNull(GraphQLInt) }, first: { type: GraphQLInt, defaultValue: 50 },
        after: { type: GraphQLString }, snapshotCursor: { type: GraphQLString },
      },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        portfolio(auth(context), args.branchId, args.first, args.after, args.snapshotCursor),
    },
    customerById: {
      type: CustomerType,
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) }, id: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) => customerById(auth(context), args.branchId, args.id),
    },
    customerByDocument: {
      type: CustomerType,
      args: {
        branchId: { type: new GraphQLNonNull(GraphQLInt) },
        documentType: { type: new GraphQLNonNull(GraphQLString) },
        documentNumber: { type: new GraphQLNonNull(GraphQLString) },
      },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        customerByDocument(auth(context), args.branchId, args.documentType, args.documentNumber),
    },
    customerCandidate: {
      type: CustomerCandidateType,
      args: {
        branchId: { type: new GraphQLNonNull(GraphQLInt) },
        documentType: { type: new GraphQLNonNull(GraphQLString) },
        documentNumber: { type: new GraphQLNonNull(GraphQLString) },
      },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        customerCandidate(auth(context), args.branchId, args.documentType, args.documentNumber),
    },
    personDocumentTypes: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PersonDocumentType))),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        personDocumentTypes(auth(context), args.branchId),
    },
    paymentHistory: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PaymentType))),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) }, creditId: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        paymentHistory(auth(context), args.branchId, String(args.creditId)),
    },
    receiptSequences: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(ReceiptSequenceType))),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        receiptSequences(auth(context), args.branchId),
    },
    bankAccounts: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(BankAccountType))),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        bankAccounts(auth(context), args.branchId),
    },
    routeSettlement: {
      type: new GraphQLNonNull(RouteSettlementType),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        routeSettlement(auth(context), args.branchId),
    },
    routeExpenseCatalog: {
      type: new GraphQLNonNull(ExpenseCatalogType),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        routeExpenseCatalog(auth(context), args.branchId),
    },
    routeEntries: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(RouteEntryType))),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        routeEntries(auth(context), args.branchId),
    },
    openRouteCash: {
      type: new GraphQLNonNull(RouteCashType),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        openRouteCash(auth(context), args.branchId),
    },
    syncChanges: {
      type: new GraphQLNonNull(SyncPageType),
      args: {
        branchId: { type: new GraphQLNonNull(GraphQLInt) }, after: { type: new GraphQLNonNull(GraphQLString) },
        first: { type: GraphQLInt, defaultValue: 100 },
      },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        syncChanges(auth(context), args.branchId, args.after, args.first),
    },
    branchPermissions: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        branchPermissions(auth(context), args.branchId),
    },
    defaultersOfPortfolio: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(DefaulterCreditType))),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        defaultersOfPortfolio(auth(context), args.branchId),
    },
    withdrawnOfPortfolio: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(WithdrawnCreditType))),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        withdrawnOfPortfolio(auth(context), args.branchId),
    },
    cancelledCredits: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(CancelledCreditType))),
      args: {
        branchId: { type: new GraphQLNonNull(GraphQLInt) },
        dateFrom: { type: new GraphQLNonNull(GraphQLString) },
        dateTo: { type: new GraphQLNonNull(GraphQLString) },
      },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        cancelledCredits(auth(context), args.branchId, args.dateFrom, args.dateTo),
    },
    portfolioClients: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PortfolioClientType))),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        portfolioClients(auth(context), args.branchId),
    },
  },
});

const Mutation = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    login: {
      type: new GraphQLNonNull(AuthPayloadType),
      args: {
        companyId: { type: new GraphQLNonNull(GraphQLInt) },
        username: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
      },
      resolve: async (_source, args) => {
        const checked = loginArgs.safeParse(args);
        if (!checked.success) fail('VALIDATION_ERROR', 'Invalid login input');
        const payload = await login(checked.data.companyId, checked.data.username, checked.data.password);
        return {
          ...payload,
          company: { id: payload.user.companyId, name: payload.user.companyName },
        };
      },
    },
    applyOfflineOperation: {
      type: new GraphQLNonNull(OperationResultType),
      args: { input: { type: new GraphQLNonNull(OfflineInputType) } },
      resolve: (_source, args: { input: OfflineInput }, context: { auth: AuthContext | null }) =>
        applyOfflineOperation(auth(context), args.input),
    },
    settleRoute: {
      type: new GraphQLNonNull(RouteSettlementType),
      args: {
        branchId: { type: new GraphQLNonNull(GraphQLInt) },
        cash: { type: new GraphQLNonNull(GraphQLFloat) },
        coins: { type: new GraphQLNonNull(GraphQLFloat) },
        difference: { type: new GraphQLNonNull(GraphQLFloat) },
      },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        settleRoute(auth(context), args.branchId, {
          cash: args.cash, coins: args.coins, difference: args.difference,
        }),
    },
    restoreCredit: {
      type: new GraphQLNonNull(RestoreCreditResultType),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) }, creditId: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        restoreCredit(auth(context), args.branchId, String(args.creditId)),
    },
  },
});

export const schema = new GraphQLSchema({ query: Query, mutation: Mutation });
