<?php

/**
 * Each test rolls the database back, but Settings keeps the options it read in a static cache. Without a reset,
 * options one test saved (such as an old database version) carry into the next test.
 */
class Redirection_Reset_Settings_Cache implements \PHPUnit\Runner\BeforeTestHook {
	public function executeBeforeTest( string $test ): void {
		\Redirection\Settings\Settings::reset();
	}
}
