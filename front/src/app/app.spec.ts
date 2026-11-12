import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app';
import { provideRouter } from '@angular/router';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();
  });

  it('shows the glassmorphism header, navigation pill, CTA and outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.brand')).not.toBeNull();
    expect(element.querySelector('.topbar-nav')).not.toBeNull();
    expect(element.querySelector('.topbar-cta')).not.toBeNull();
    expect(element.querySelector('router-outlet')).not.toBeNull();
  });

  it('toggles the compact scrolled state on window scroll', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.componentInstance.scrolled()).toBe(false);
    Object.defineProperty(window, 'scrollY', { value: 60, configurable: true });
    fixture.componentInstance.onWindowScroll();
    fixture.detectChanges();

    expect(fixture.componentInstance.scrolled()).toBe(true);
    expect(fixture.nativeElement.querySelector('.topbar-shell.topbar-scrolled')).not.toBeNull();
  });
});
