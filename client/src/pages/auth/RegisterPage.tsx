import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  MapPin,
  User,
} from 'lucide-react';
import api from '@/api/client';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setCredentials } from '@/store/slices/authSlice';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { FileUpload } from '@/components/ui/FileUpload';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { RegistrationAgreementSection } from '@/components/auth/RegistrationAgreementSection';
import { uploadRegisterLogo } from '@/lib/upload';
import { resolveMediaUrl } from '@/lib/media';
import { getStatesForCountry } from '@/lib/location-data';
import { validateFieldValue } from '@/lib/form-fields';
import { loginPath } from '@/lib/workspace-portal';
import { toast } from 'sonner';

const STEPS = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'review', label: 'Review', icon: FileText },
] as const;

type StepId = (typeof STEPS)[number]['id'];

interface RegisterForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  phone: string;
  gst: string;
  pan: string;
  logo: string;
  logoFilename: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  agreeToTerms: boolean;
}

const emptyForm = (): RegisterForm => ({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  companyName: '',
  phone: '',
  gst: '',
  pan: '',
  logo: '',
  logoFilename: '',
  street: '',
  city: '',
  state: '',
  country: 'India',
  zipCode: '',
  agreeToTerms: false,
});

export default function RegisterPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [step, setStep] = useState<StepId>('account');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<RegisterForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterForm, string>>>({});
  const [googleCredential, setGoogleCredential] = useState<string | null>(null);
  const [isGoogleSignup, setIsGoogleSignup] = useState(false);

  const { data: branding } = useQuery({
    queryKey: ['auth-branding'],
    queryFn: async () => (await api.get('/auth/branding')).data.data as {
      name: string;
      logo: string;
      tagline: string;
    },
  });

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const platformLogo = resolveMediaUrl(branding?.logo);
  const stateOptions = getStatesForCountry(form.country);

  const setField = <K extends keyof RegisterForm>(key: K, value: RegisterForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validateStep = (current: StepId): boolean => {
    const nextErrors: Partial<Record<keyof RegisterForm, string>> = {};

    if (current === 'account') {
      if (!form.firstName.trim()) nextErrors.firstName = 'First name is required';
      if (!form.lastName.trim()) nextErrors.lastName = 'Last name is required';
      if (!form.email.trim()) nextErrors.email = 'Email is required';
      else {
        const emailErr = validateFieldValue('email', form.email, { required: true });
        if (emailErr) nextErrors.email = emailErr;
      }
      if (!isGoogleSignup) {
        if (!form.password) nextErrors.password = 'Password is required';
        else {
          const pwdErr = validateFieldValue('password-new', form.password, { required: true });
          if (pwdErr) nextErrors.password = pwdErr;
        }
        if (form.password !== form.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match';
      } else if (!googleCredential) {
        nextErrors.email = 'Connect your Google account to continue';
      }
    }

    if (current === 'company') {
      if (!form.companyName.trim()) nextErrors.companyName = 'Company name is required';
      if (form.phone.trim()) {
        const phoneErr = validateFieldValue('phone', form.phone);
        if (phoneErr) nextErrors.phone = phoneErr;
      }
      if (form.gst.trim()) {
        const gstErr = validateFieldValue('gstin', form.gst);
        if (gstErr) nextErrors.gst = gstErr;
      }
      if (form.pan.trim()) {
        const panErr = validateFieldValue('pan', form.pan);
        if (panErr) nextErrors.pan = panErr;
      }
    }

    if (current === 'address') {
      if (!form.city.trim()) nextErrors.city = 'City is required';
      if (!form.state.trim()) nextErrors.state = 'State is required';
      if (!form.country.trim()) nextErrors.country = 'Country is required';
      if (!form.zipCode.trim()) nextErrors.zipCode = 'ZIP code is required';
      else if (form.country === 'India') {
        const pinErr = validateFieldValue('pincode', form.zipCode, { required: true });
        if (pinErr) nextErrors.zipCode = pinErr;
      }
    }

    if (current === 'review') {
      if (!form.agreeToTerms) nextErrors.agreeToTerms = 'You must accept the terms';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next.id);
  };

  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  };

  const onSubmit = async () => {
    if (!validateStep('review')) return;
    setLoading(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        companyName: form.companyName.trim(),
        phone: form.phone.trim() || undefined,
        gst: form.gst.trim() || undefined,
        pan: form.pan.trim() || undefined,
        logo: form.logo || undefined,
        logoFilename: form.logoFilename || undefined,
        address: {
          street: form.street.trim() || undefined,
          city: form.city.trim(),
          state: form.state.trim(),
          country: form.country.trim(),
          zipCode: form.zipCode.trim(),
        },
      };

      if (isGoogleSignup && googleCredential) {
        const res = await api.post('/auth/google/register', {
          ...payload,
          credential: googleCredential,
        });
        const { user, accessToken, refreshToken, subscriptionActive } = res.data.data;
        dispatch(setCredentials({ user, accessToken, refreshToken }));
        toast.success('Account created with Google!');
        navigate(subscriptionActive === false ? '/admin/subscription/plans' : '/admin');
        return;
      }

      await api.post('/auth/register', {
        ...payload,
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        agreeToTerms: true,
      });
      navigate(loginPath('admin', { registered: '1', email: form.email.trim() }));
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = (credential: string) => {
    try {
      const payload = JSON.parse(atob(credential.split('.')[1])) as {
        email?: string;
        given_name?: string;
        family_name?: string;
        name?: string;
      };
      setGoogleCredential(credential);
      setIsGoogleSignup(true);
      setField('email', payload.email || '');
      setField('firstName', payload.given_name || payload.name?.split(' ')[0] || '');
      setField('lastName', payload.family_name || payload.name?.split(' ').slice(1).join(' ') || '');
      setField('password', '');
      setField('confirmPassword', '');
      toast.success('Google account connected. Complete your company details.');
    } catch {
      toast.error('Could not read Google profile');
    }
  };

  const selectClass =
    'w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

  const formCard = (
    <div className="glass p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Create your business account</h2>
        <p className="mt-1 text-sm text-gray-500">
          Step {stepIndex + 1} of {STEPS.length} — {STEPS[stepIndex].label}
        </p>
      </div>

            <div className="mb-8 flex items-center gap-2">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const done = i < stepIndex;
                const active = i === stepIndex;
                return (
                  <div key={s.id} className="flex flex-1 items-center gap-2">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                        done
                          ? 'bg-primary text-white'
                          : active
                            ? 'bg-primary text-white ring-4 ring-primary/20'
                            : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 rounded ${i < stepIndex ? 'bg-primary' : 'bg-gray-200'}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                {step === 'account' && (
                  <div className="space-y-4">
                    <GoogleSignInButton
                      mode="signup"
                      onCredential={handleGoogleCredential}
                      disabled={loading}
                    />
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-gray-200" />
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        or register with email
                      </span>
                      <div className="h-px flex-1 bg-gray-200" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="First name"
                        value={form.firstName}
                        onChange={(e) => setField('firstName', e.target.value)}
                        error={errors.firstName}
                      />
                      <Input
                        label="Last name"
                        value={form.lastName}
                        onChange={(e) => setField('lastName', e.target.value)}
                        error={errors.lastName}
                      />
                    </div>
                    <Input
                      label="Work email"
                      fieldKind="email"
                      value={form.email}
                      onChange={(e) => {
                        if (!isGoogleSignup) setField('email', e.target.value);
                      }}
                      readOnly={isGoogleSignup}
                      error={errors.email}
                    />
                    {isGoogleSignup ? (
                      <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                        Signed in with Google. Continue to add your company details.
                      </p>
                    ) : (
                      <>
                        <Input
                          label="Password"
                          fieldKind="password-new"
                          value={form.password}
                          onChange={(e) => setField('password', e.target.value)}
                          error={errors.password}
                        />
                        <Input
                          label="Confirm password"
                          fieldKind="password-confirm"
                          value={form.confirmPassword}
                          onChange={(e) => setField('confirmPassword', e.target.value)}
                          error={errors.confirmPassword}
                        />
                      </>
                    )}
                  </div>
                )}

                {step === 'company' && (
                  <div className="space-y-4">
                    <Input
                      label="Company name"
                      value={form.companyName}
                      onChange={(e) => setField('companyName', e.target.value)}
                      error={errors.companyName}
                    />
                    <Input
                      label="Phone number"
                      fieldKind="phone"
                      value={form.phone}
                      onChange={(e) => setField('phone', e.target.value)}
                      error={errors.phone}
                    />
                    <FileUpload
                      label="Company logo"
                      hint="PNG or JPG, max 5MB. Shown on your invoices and workspace."
                      value={form.logo}
                      filename={form.logoFilename}
                      uploadFn={uploadRegisterLogo}
                      onChange={(url, meta) => {
                        setField('logo', url);
                        setField('logoFilename', meta?.filename || '');
                      }}
                      onClear={() => {
                        setField('logo', '');
                        setField('logoFilename', '');
                      }}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="GST number (optional)"
                        fieldKind="gstin"
                        value={form.gst}
                        onChange={(e) => setField('gst', e.target.value)}
                        error={errors.gst}
                      />
                      <Input
                        label="PAN (optional)"
                        fieldKind="pan"
                        value={form.pan}
                        onChange={(e) => setField('pan', e.target.value)}
                        error={errors.pan}
                      />
                    </div>
                  </div>
                )}

                {step === 'address' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">
                      Business address for invoices and compliance records.
                    </p>
                    <Input
                      label="Street address"
                      placeholder="Building, street, area"
                      value={form.street}
                      onChange={(e) => setField('street', e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="City"
                        value={form.city}
                        onChange={(e) => setField('city', e.target.value)}
                        error={errors.city}
                      />
                      {stateOptions ? (
                        <SearchableSelect
                          label="State"
                          value={form.state}
                          onChange={(value) => setField('state', value)}
                          options={stateOptions}
                          placeholder="Select state"
                          searchPlaceholder="Search states..."
                          error={errors.state}
                        />
                      ) : (
                        <Input
                          label="State / Province"
                          value={form.state}
                          onChange={(e) => setField('state', e.target.value)}
                          error={errors.state}
                        />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-gray-700">Country</label>
                        <select
                          className={selectClass}
                          value={form.country}
                          onChange={(e) => {
                            setField('country', e.target.value);
                            setField('state', '');
                          }}
                        >
                          <option value="India">India</option>
                          <option value="United States">United States</option>
                          <option value="United Kingdom">United Kingdom</option>
                          <option value="United Arab Emirates">United Arab Emirates</option>
                          <option value="Singapore">Singapore</option>
                          <option value="Other">Other</option>
                        </select>
                        {errors.country && (
                          <p className="text-xs text-red-500">{errors.country}</p>
                        )}
                      </div>
                      <Input
                        label="ZIP / Postal code"
                        fieldKind={form.country === 'India' ? 'pincode' : undefined}
                        value={form.zipCode}
                        onChange={(e) => setField('zipCode', e.target.value)}
                        error={errors.zipCode}
                      />
                    </div>
                  </div>
                )}

                {step === 'review' && (
                  <div className="space-y-5">
                    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 space-y-3 text-sm">
                      <div className="flex items-center gap-4 pb-3 border-b border-gray-100">
                        {form.logo && resolveMediaUrl(form.logo) ? (
                          <img
                            src={resolveMediaUrl(form.logo)}
                            alt="Company logo"
                            className="h-14 w-14 rounded-lg border border-gray-200 bg-white object-contain"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-lg bg-primary-50 flex items-center justify-center">
                            <Building2 className="h-7 w-7 text-primary" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">{form.companyName}</p>
                          <p className="text-gray-500">
                            {form.firstName} {form.lastName} · {form.email}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-gray-600">
                        <span className="text-gray-400">Phone</span>
                        <span>{form.phone || '—'}</span>
                        <span className="text-gray-400">GST</span>
                        <span>{form.gst || '—'}</span>
                        <span className="text-gray-400">PAN</span>
                        <span>{form.pan || '—'}</span>
                        <span className="text-gray-400">Address</span>
                        <span>
                          {[form.street, form.city, form.state, form.zipCode, form.country]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    </div>

                    <RegistrationAgreementSection
                      agreed={form.agreeToTerms}
                      onAgreedChange={(value) => setField('agreeToTerms', value)}
                      error={errors.agreeToTerms}
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex items-center justify-between gap-4">
              {stepIndex > 0 ? (
                <Button type="button" variant="outline" onClick={goBack}>
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              ) : (
                <div />
              )}

              {step !== 'review' ? (
                <Button type="button" onClick={goNext}>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" loading={loading} onClick={onSubmit}>
                  Create account
                </Button>
              )}
            </div>

            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link to={loginPath('admin')} className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
    </div>
  );

  if (embedded) {
    return formCard;
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-5/12 xl:w-2/5 bg-gradient-to-br from-primary to-primary-700 items-center justify-center p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-white max-w-md"
        >
          {platformLogo ? (
            <img
              src={platformLogo}
              alt={branding?.name || 'Invogen'}
              className="h-14 w-auto max-w-[200px] object-contain mb-8 brightness-0 invert"
            />
          ) : (
            <h1 className="text-4xl font-bold mb-8">{branding?.name || 'Invogen'}</h1>
          )}
          <h2 className="text-3xl font-bold leading-tight mb-4">
            Start your professional invoicing workspace
          </h2>
          <p className="text-primary-100 text-lg leading-relaxed">
            {branding?.tagline ||
              'Premium invoice builder for modern businesses. Create, customize, and send professional invoices.'}
          </p>
          <ul className="mt-10 space-y-4 text-primary-50 text-sm">
            {[
              'Multi-step onboarding with company profile',
              'Upload your company logo for branded invoices',
              'GST-ready templates and team workspaces',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <Check className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 sm:p-10 bg-gray-50">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-xl"
        >
          <div className="mb-8 lg:hidden text-center">
            {platformLogo ? (
              <img
                src={platformLogo}
                alt={branding?.name || 'Invogen'}
                className="h-10 mx-auto object-contain"
              />
            ) : (
              <span className="text-2xl font-bold text-primary">{branding?.name || 'Invogen'}</span>
            )}
          </div>

          {formCard}
        </motion.div>
      </div>
    </div>
  );
}
